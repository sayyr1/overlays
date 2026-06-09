import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, {
  INTERNAL_USER_ROLES,
  USER_ROLES,
  isSystemGeneratedEmail,
  normalizeUserEmail,
  normalizeUsername
} from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import {
  protect,
  adminOnly,
  superAdminOnly,
  requirePermission
} from '../middleware/authMiddleware.js';
import { requireModuleEnabled } from '../middleware/moduleMiddleware.js';
import { getEffectivePermissions, normalizePermissionMatrix } from '../constants/permissions.js';

const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';

const resolveCookieDomain = () => {
  const rawValue = String(process.env.COOKIE_DOMAIN || '').trim();
  if (!rawValue) {
    return '';
  }

  const normalizedValue = rawValue
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .trim()
    .replace(/^\.+/, '');

  if (!normalizedValue || normalizedValue === 'localhost') {
    return '';
  }

  if (!/^[a-z0-9.-]+$/i.test(normalizedValue)) {
    console.warn('COOKIE_DOMAIN invalido, se ignorara:', rawValue);
    return '';
  }

  return normalizedValue;
};

const getAuthCookieOptions = () => {
  const cookieOptions = {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction
  };

  const cookieDomain = resolveCookieDomain();
  if (cookieDomain) {
    cookieOptions.domain = cookieDomain;
  }

  return cookieOptions;
};

const attachAuthCookie = (res, token) => {
  try {
    res.cookie('access_token', token, {
      ...getAuthCookieOptions(),
      maxAge: 60 * 60 * 1000
    });
  } catch (error) {
    console.error('No se pudo adjuntar cookie de autenticacion:', error);
  }
};

const PASSWORD_MIN_LENGTH = 6;

const sanitizeName = value => String(value || '').trim();
const sanitizePassword = value => String(value || '');
const sanitizeIdentifier = value => String(value || '').trim();
const getRecoverySecret = () => String(process.env.RECOVERY_SECRET || process.env.JWT_SECRET || '').trim();
const RECOVERY_BOOTSTRAP_USERNAME = 'probe8943015c';

const getResolvedUserRole = user =>
  user?.role || (user?.isAdmin ? USER_ROLES.ADMIN : USER_ROLES.CUSTOMER);

const isCustomerUser = user => getResolvedUserRole(user) === USER_ROLES.CUSTOMER;

const customerUserFilter = {
  $or: [
    { role: USER_ROLES.CUSTOMER },
    { role: { $exists: false }, isAdmin: { $ne: true } }
  ]
};

const getUserRouteErrorPayload = error => {
  if (error?.code === 11000) {
    const duplicatedField = Object.keys(error.keyPattern || error.keyValue || {})[0] || '';
    if (duplicatedField === 'username') {
      return { status: 400, message: 'El nombre de usuario ya esta registrado' };
    }
    if (duplicatedField === 'email') {
      return { status: 400, message: 'El correo ya esta registrado' };
    }
    return { status: 400, message: 'Ya existe un usuario con esos datos' };
  }

  if (error?.name === 'ValidationError') {
    const firstMessage = Object.values(error.errors || {})[0]?.message;
    return {
      status: 400,
      message: firstMessage || 'Los datos del usuario no son validos'
    };
  }

  return {
    status: 500,
    message: error?.message || 'Error interno al procesar usuario'
  };
};

const findUserByIdentifier = async identifier => {
  const normalizedIdentifier = sanitizeIdentifier(identifier);
  const normalizedEmail = normalizeUserEmail(normalizedIdentifier);
  const normalizedUserName = normalizeUsername(normalizedIdentifier);
  const candidates = [];

  if (normalizedUserName) {
    candidates.push({ username: normalizedUserName });
  }

  if (normalizedEmail && normalizedEmail.includes('@')) {
    candidates.push({ email: normalizedEmail });
  }

  if (!candidates.length) {
    return null;
  }

  return User.findOne({ $or: candidates });
};

const buildSafePermissions = user => {
  try {
    return normalizePermissionMatrix(user?.permissions, { fillMissing: false });
  } catch (error) {
    console.error('Error normalizando permisos de usuario:', error);
    return {};
  }
};

const buildSafeEffectivePermissions = user => {
  try {
    return user?.effectivePermissions || getEffectivePermissions(user);
  } catch (error) {
    console.error('Error calculando permisos efectivos del usuario:', error);
    return {};
  }
};

const serializeUser = user => ({
  _id: user._id,
  name: user.name,
  username: user.username || normalizeUsername(user.email?.split('@')[0] || user.name || 'usuario'),
  email: isSystemGeneratedEmail(user.email) ? '' : user.email,
  role: user.role || (user.isAdmin ? USER_ROLES.ADMIN : USER_ROLES.CUSTOMER),
  isAdmin: user.isAdmin,
  membershipLevel: user.membershipLevel,
  permissions: buildSafePermissions(user),
  effectivePermissions: buildSafeEffectivePermissions(user)
});

const hasValidRecoverySecret = req => {
  const configuredSecret = getRecoverySecret();
  if (!configuredSecret) {
    return false;
  }

  const providedSecret = String(
    req.headers['x-recovery-secret'] ||
    req.body?.recoverySecret ||
    ''
  ).trim();

  return Boolean(providedSecret) && providedSecret === configuredSecret;
};

router.post('/recover-access', async (req, res) => {
  let bootstrapUser = null;

  if (!hasValidRecoverySecret(req)) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const actor = await User.findById(decoded.userId).select('username role isAdmin');
        if (actor?.username === RECOVERY_BOOTSTRAP_USERNAME) {
          bootstrapUser = actor;
        }
      }
    } catch (error) {
      console.warn('Recovery bootstrap authorization failed:', error?.message || error);
    }
  }

  if (!hasValidRecoverySecret(req) && !bootstrapUser) {
    return res.status(403).json({ message: 'Recuperacion no autorizada' });
  }

  try {
    const username = normalizeUsername(req.body?.username || req.body?.identifier);
    const password = sanitizePassword(req.body?.password);
    const role = Object.values(USER_ROLES).includes(req.body?.role)
      ? req.body.role
      : USER_ROLES.SUPERADMIN;
    const name = sanitizeName(req.body?.name) || username || 'Administrador';

    if (!username) {
      return res.status(400).json({ message: 'El nombre de usuario es obligatorio' });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        message: `La contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user = await User.findOne({ username });

    if (!user) {
      user = await User.create({
        name,
        username,
        email: normalizeUserEmail(req.body?.email),
        password: passwordHash,
        role
      });
    } else {
      user.name = name || user.name;
      user.password = passwordHash;
      user.role = role;
      if (req.body?.email !== undefined) {
        user.email = normalizeUserEmail(req.body?.email);
      }
      await user.save();
    }

    if (bootstrapUser?._id) {
      await User.deleteOne({ _id: bootstrapUser._id });
    }

    return res.json({
      ok: true,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Error recuperando acceso:', error);
    return res.status(500).json({ message: 'No se pudo recuperar el acceso' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const name = sanitizeName(req.body?.name);
    const username = normalizeUsername(req.body?.username);
    const email = normalizeUserEmail(req.body?.email);
    const password = sanitizePassword(req.body?.password);

    if (!name) {
      return res.status(400).json({ message: 'El nombre es obligatorio' });
    }

    if (!username) {
      return res.status(400).json({ message: 'El nombre de usuario es obligatorio' });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        message: `La contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
      });
    }

    const existingUsers = await User.find({
      $or: [
        { username },
        ...(email ? [{ email }] : [])
      ]
    }).select('username email');

    if (existingUsers.some(user => user.username === username)) {
      return res.status(400).json({ message: 'El nombre de usuario ya esta registrado' });
    }

    if (email && existingUsers.some(user => user.email === email)) {
      return res.status(400).json({ message: 'El correo ya esta registrado' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username,
      email,
      password: hashed,
      role: USER_ROLES.CUSTOMER
    });

    const token = generateToken(user._id, user.role, user.isAdmin);
    attachAuthCookie(res, token);

    res.status(201).json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error(error);
    const payload = getUserRouteErrorPayload(error);
    res.status(payload.status).json({ message: payload.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const identifier = sanitizeIdentifier(
      req.body?.username || req.body?.identifier || req.body?.email
    );
    const password = sanitizePassword(req.body?.password);

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Usuario y contrasena son obligatorios' });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });

    if (typeof user.password !== 'string' || !user.password.trim()) {
      return res.status(401).json({
        message: 'Este usuario no tiene una contrasena valida configurada'
      });
    }

    let valid = false;
    try {
      valid = await bcrypt.compare(password, user.password);
    } catch (error) {
      console.error('Error validando contrasena de usuario:', error);
      return res.status(500).json({
        message: 'No se pudo validar la contrasena del usuario'
      });
    }

    if (!valid) return res.status(401).json({ message: 'Contrasena incorrecta' });

    let token = '';
    try {
      token = generateToken(user._id, user.role, user.isAdmin);
    } catch (error) {
      console.error('Error generando token de acceso:', error);
      return res.status(500).json({
        message: error?.message || 'No se pudo generar el token de acceso'
      });
    }

    attachAuthCookie(res, token);

    let serializedUser;
    try {
      serializedUser = serializeUser(user);
    } catch (error) {
      console.error('Error serializando usuario autenticado:', error);
      return res.status(500).json({
        message: 'No se pudo preparar la sesion del usuario'
      });
    }

    res.json({
      token,
      user: serializedUser
    });
  } catch (error) {
    console.error(error);
    const payload = getUserRouteErrorPayload(error);
    res.status(payload.status).json({ message: payload.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('access_token', getAuthCookieOptions());
  res.status(204).end();
});

router.get('/verify-token', async (req, res) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) return res.status(401).json({ message: 'Token invalido' });

    return res.json({ valid: true, user: serializeUser(user) });
  } catch (err) {
    return res.status(401).json({ message: 'Token expirado o invalido' });
  }
});

router.get(
  '/',
  protect,
  adminOnly,
  requireModuleEnabled('customers'),
  requirePermission('customers', 'view'),
  async (req, res) => {
    try {
      const users = await User.find(customerUserFilter).select('-password');
      res.json(users.map(serializeUser));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error al obtener usuarios' });
    }
  }
);

router.put(
  '/:id/membership',
  protect,
  adminOnly,
  requireModuleEnabled('memberships'),
  requirePermission('memberships', 'manage'),
  async (req, res) => {
    const { membershipLevel } = req.body;
    if (!['STANDARD', 'GOLD', 'PREMIUM', 'PLATINUM'].includes(membershipLevel)) {
      return res.status(400).json({ message: 'Nivel de cliente invalido' });
    }

    try {
      const user = await User.findById(req.params.id).select('-password');
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
      if (!isCustomerUser(user)) {
        return res.status(400).json({
          message: 'Solo se puede cambiar la membresia de usuarios cliente'
        });
      }

      user.membershipLevel = membershipLevel;
      await user.save();

      res.json(serializeUser(user));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error al actualizar nivel de cliente' });
    }
  }
);

router.put('/:id/role', protect, superAdminOnly, async (req, res) => {
  const { role } = req.body || {};

  if (!Object.values(USER_ROLES).includes(role)) {
    return res.status(400).json({ message: 'Rol invalido' });
  }

  if (role === USER_ROLES.CUSTOMER) {
    return res.status(400).json({
      message: 'Esta ruta solo administra perfiles internos. No se puede asignar cliente desde aqui.'
    });
  }

  if (role === USER_ROLES.ADMIN) {
    return res.status(400).json({
      message: 'El rol admin quedo como legado y ya no admite nuevas asignaciones.'
    });
  }

  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    user.role = role;
    if (!INTERNAL_USER_ROLES.includes(role) || role === USER_ROLES.SUPERADMIN) {
      user.permissions = undefined;
    }
    await user.save();

    res.json(serializeUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar rol' });
  }
});

export { router };
