import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/admin/AdminNav/AdminSidebar';
import AdminBottomNav from '../../components/admin/AdminNav/AdminBottomNav';
import AdminTopbar from '../../components/admin/AdminNav/AdminTopbar';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, isAdmin, isSuperAdmin, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const hideAdminTopbar =
    location.pathname.startsWith('/crear-producto');

  if (!isAuthenticated || !isAdmin) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <>
      <AdminSidebar handleLogout={handleLogout} user={user} isSuperAdmin={isSuperAdmin} />
      {!hideAdminTopbar ? <AdminTopbar handleLogout={handleLogout} user={user} /> : null}
      <AdminBottomNav handleLogout={handleLogout} isSuperAdmin={isSuperAdmin} />
    </>
  );
};

export default Navbar;
