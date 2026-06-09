import jwt from 'jsonwebtoken';
import User, { USER_ROLES } from '../models/User.js';
import {
  getEffectivePermissions,
  hasPermission,
  parsePermissionDescriptor
} from '../constants/permissions.js';

const ROLE_HIERARCHY = {
  [USER_ROLES.CUSTOMER]: 1,
  [USER_ROLES.SALES]: 2,
  [USER_ROLES.OWNER]: 2,
  [USER_ROLES.ADMIN]: 2,
  [USER_ROLES.SUPERADMIN]: 3
};

const getTokenFromRequest = req => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return req.cookies?.access_token || null;
};

const normalizeUserRole = user => {
  if (!user) return USER_ROLES.CUSTOMER;
  if (user.role) return user.role;
  return user.isAdmin ? USER_ROLES.ADMIN : USER_ROLES.CUSTOMER;
};

const buildSafeEffectivePermissions = user => {
  try {
    return getEffectivePermissions(user);
  } catch (error) {
    console.error('Error calculando permisos efectivos en authMiddleware:', error);
    return {};
  }
};

export const protect = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: 'No autorizado, sin token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    user.role = normalizeUserRole(user);
    user.effectivePermissions = buildSafeEffectivePermissions(user);
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalido' });
  }
};

export const requireRole = minimumRole => (req, res, next) => {
  const currentRole = normalizeUserRole(req.user);
  const currentLevel = ROLE_HIERARCHY[currentRole] ?? 0;
  const minimumLevel = ROLE_HIERARCHY[minimumRole] ?? Number.MAX_SAFE_INTEGER;

  if (currentLevel >= minimumLevel) {
    return next();
  }

  return res.status(403).json({ message: 'Acceso denegado: permisos insuficientes' });
};

export const adminOnly = requireRole(USER_ROLES.ADMIN);
export const superAdminOnly = requireRole(USER_ROLES.SUPERADMIN);

export const requirePermission = (moduleOrDescriptor, action, options = {}) => (req, res, next) => {
  const parsed = action
    ? { moduleKey: moduleOrDescriptor, actionKey: action }
    : parsePermissionDescriptor(moduleOrDescriptor);
  const { moduleKey, actionKey } = parsed;

  if (!moduleKey || !actionKey) {
    return res.status(500).json({ message: 'Permiso mal configurado en servidor' });
  }

  if (hasPermission(req.user, moduleKey, actionKey)) {
    return next();
  }

  const message = options.message || 'Acceso denegado: permiso insuficiente';
  return res.status(403).json({
    message,
    permission: `${moduleKey}.${actionKey}`
  });
};

export const optionalProtect = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (user) {
      user.role = normalizeUserRole(user);
      user.effectivePermissions = buildSafeEffectivePermissions(user);
      req.user = user;
    }
  } catch (error) {
    console.warn('Token no valido ignorado en optionalProtect');
  }

  return next();
};
