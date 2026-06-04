import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { USER_ROLES } from '../models/User.js';
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

const attachAuthCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 60 * 60 * 1000
  };
  if (process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }
  res.cookie('access_token', token, cookieOptions);
};

const serializeUser = user => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role || (user.isAdmin ? USER_ROLES.ADMIN : USER_ROLES.CUSTOMER),
  isAdmin: user.isAdmin,
  membershipLevel: user.membershipLevel,
  permissions: normalizePermissionMatrix(user.permissions, { fillMissing: false }),
  effectivePermissions: user.effectivePermissions || getEffectivePermissions(user)
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  const exist = await User.findOne({ email });
  if (exist) return res.status(400).json({ message: 'Email ya registrado' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
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
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Contraseña incorrecta' });

  const token = generateToken(user._id, user.role, user.isAdmin);
  attachAuthCookie(res, token);

  res.json({
    token,
    user: serializeUser(user)
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('access_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  });
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

    if (!user) return res.status(401).json({ message: 'Token inválido' });

    return res.json({ valid: true, user: serializeUser(user) });
  } catch (err) {
    return res.status(401).json({ message: 'Token expirado o inválido' });
  }
});

router.get('/', protect, adminOnly, requireModuleEnabled('customers'), requirePermission('customers', 'view'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users.map(serializeUser));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

router.put('/:id/membership', protect, adminOnly, requireModuleEnabled('memberships'), requirePermission('memberships', 'manage'), async (req, res) => {
  const { membershipLevel } = req.body;
  if (!['STANDARD', 'GOLD', 'PREMIUM', 'PLATINUM'].includes(membershipLevel)) {
    return res.status(400).json({ message: 'Nivel de cliente inválido' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { membershipLevel },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(serializeUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar nivel de cliente' });
  }
});

router.put('/:id/role', protect, superAdminOnly, async (req, res) => {
  const { role } = req.body || {};

  if (!Object.values(USER_ROLES).includes(role)) {
    return res.status(400).json({ message: 'Rol inválido' });
  }

  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    user.role = role;
    if (role !== USER_ROLES.ADMIN) {
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
