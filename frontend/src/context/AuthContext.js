import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios, {
  clearStoredAuthToken,
  getStoredAuthToken,
  setStoredAuthToken
} from '../api/axiosInstance';

const AuthContext = createContext(null);
const EMPTY_PERMISSIONS = {};
const INTERNAL_ROLES = new Set(['sales', 'owner', 'admin', 'superadmin']);
const AUTH_REQUIRED_PATH_PREFIXES = [
  '/super-admin',
  '/admin-dashboard',
  '/dashboard',
  '/pedidos',
  '/ventas',
  '/gestionar-categorias',
  '/menu-builder',
  '/crear-producto',
  '/editar-producto',
  '/crm',
  '/mis-pedidos'
];

const shouldHydrateSession = () => {
  if (typeof window === 'undefined') {
    return true;
  }

  if (getStoredAuthToken()) {
    return true;
  }

  const pathname = String(window.location?.pathname || '').trim();
  return AUTH_REQUIRED_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
};

const parsePermission = (moduleOrDescriptor, action) => {
  if (action) {
    return { moduleKey: moduleOrDescriptor, actionKey: action };
  }

  if (typeof moduleOrDescriptor !== 'string') {
    return { moduleKey: '', actionKey: '' };
  }

  const [moduleKey = '', actionKey = ''] = moduleOrDescriptor.split('.');
  return { moduleKey, actionKey };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    if (!shouldHydrateSession()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const { data } = await axios.get('/api/users/verify-token', { withCredentials: true });
      setUser(data.user);
    } catch {
      clearStoredAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const login = useCallback(async credentials => {
    const { data } = await axios.post('/api/users/login', credentials, { withCredentials: true });
    setStoredAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async payload => {
    const { data } = await axios.post('/api/users/register', payload, { withCredentials: true });
    setStoredAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post('/api/users/logout', {}, { withCredentials: true });
    } finally {
      clearStoredAuthToken();
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback(
    (moduleOrDescriptor, action) => {
      const role = user?.role ?? (user?.isAdmin ? 'admin' : 'customer');
      if (role === 'superadmin') {
        return true;
      }

      const { moduleKey, actionKey } = parsePermission(moduleOrDescriptor, action);
      if (!moduleKey || !actionKey) {
        return false;
      }

      return Boolean(user?.effectivePermissions?.[moduleKey]?.[actionKey]);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    permissions =>
      (Array.isArray(permissions) ? permissions : [permissions]).some(permission => {
        if (Array.isArray(permission)) {
          return hasPermission(permission[0], permission[1]);
        }
        return hasPermission(permission);
      }),
    [hasPermission]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      role: user?.role ?? (user?.isAdmin ? 'admin' : 'customer'),
      isAuthenticated: Boolean(user),
      isAdmin: Boolean(user?.isAdmin || INTERNAL_ROLES.has(user?.role)),
      isSuperAdmin: user?.role === 'superadmin',
      membershipLevel: user?.membershipLevel ?? 'STANDARD',
      permissions: user?.effectivePermissions ?? EMPTY_PERMISSIONS,
      hasPermission,
      hasAnyPermission
    }),
    [user, loading, login, register, logout, hasPermission, hasAnyPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
