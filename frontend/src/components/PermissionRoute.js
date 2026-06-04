import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PermissionRoute = ({
  children,
  permission,
  permissions = [],
  mode = 'all',
  fallback = '/'
}) => {
  const location = useLocation();
  const { loading, hasPermission, hasAnyPermission } = useAuth();

  if (loading) {
    return null;
  }

  const requiredPermissions = [
    ...(permission ? [permission] : []),
    ...(Array.isArray(permissions) ? permissions : [permissions]).filter(Boolean)
  ];

  if (!requiredPermissions.length) {
    return children;
  }

  const allowed =
    mode === 'any'
      ? hasAnyPermission(requiredPermissions)
      : requiredPermissions.every(item => {
          if (Array.isArray(item)) {
            return hasPermission(item[0], item[1]);
          }
          return hasPermission(item);
        });

  if (!allowed) {
    return <Navigate to={fallback} replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default PermissionRoute;
