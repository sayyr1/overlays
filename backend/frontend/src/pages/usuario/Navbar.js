import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/admin/AdminNav/AdminSidebar';
import AdminBottomNav from '../../components/admin/AdminNav/AdminBottomNav';
import AdminTopbar from '../../components/admin/AdminNav/AdminTopbar';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, isAdmin, logout, user } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated || !isAdmin) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <>
      <AdminSidebar handleLogout={handleLogout} />
      <AdminTopbar handleLogout={handleLogout} user={user} />
      <AdminBottomNav handleLogout={handleLogout} />
    </>
  );
};

export default Navbar;
