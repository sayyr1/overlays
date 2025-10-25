import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from '../api/axiosInstance';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/users/verify-token', { withCredentials: true });
      setUser(data.user);
    } catch {
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
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async payload => {
    const { data } = await axios.post('/api/users/register', payload, { withCredentials: true });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post('/api/users/logout', {}, { withCredentials: true });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      isAuthenticated: Boolean(user),
      isAdmin: Boolean(user?.isAdmin),
      membershipLevel: user?.membershipLevel ?? 'STANDARD'
    }),
    [user, loading, login, register, logout]
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
