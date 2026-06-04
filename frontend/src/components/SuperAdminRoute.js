import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SuperAdminRoute = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isSuperAdmin, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default SuperAdminRoute;
