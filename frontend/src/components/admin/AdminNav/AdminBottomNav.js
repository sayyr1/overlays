import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HiOutlineChartPie,
  HiOutlineSquares2X2,
  HiOutlinePlusCircle,
  HiOutlineInboxStack,
  HiOutlineUsers,
  HiOutlineArrowRightOnRectangle,
  HiOutlineCog6Tooth
} from 'react-icons/hi2';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import { useAuth } from '../../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/admin-dashboard', label: 'Inicio', icon: HiOutlineChartPie },
  { to: '/dashboard', label: 'Inventario', icon: HiOutlineSquares2X2 },
  { to: '/crear-producto', label: 'Nuevo', icon: HiOutlinePlusCircle },
  { to: '/crm', label: 'CRM', icon: HiOutlineUsers },
  { to: '/pedidos', label: 'Pedidos', icon: HiOutlineInboxStack }
];

const AdminBottomNav = ({ handleLogout, isSuperAdmin = false }) => {
  const location = useLocation();
  const isCrmRoute = location.pathname.startsWith('/crm');
  const { isModuleEnabled, loading } = usePublicConfig();
  const { hasPermission, hasAnyPermission } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  const navItems = isSuperAdmin
    ? [
        ...(hasAnyPermission(['reports.view', 'customers.view'])
          ? [{ to: '/admin-dashboard', label: 'Inicio', icon: HiOutlineChartPie }]
          : []),
        ...(isModuleEnabled('products') && hasAnyPermission(['products.view', 'inventory.view'])
          ? [{ to: '/dashboard', label: 'Inventario', icon: HiOutlineSquares2X2 }]
          : []),
        ...(isModuleEnabled('orders') && hasPermission('orders.view')
          ? [{ to: '/pedidos', label: 'Pedidos', icon: HiOutlineInboxStack }]
          : []),
        ...(isModuleEnabled('crm') && hasPermission('crm.dashboard')
          ? [{ to: '/crm', label: 'CRM', icon: HiOutlineUsers }]
          : []),
        { to: '/super-admin', label: 'Super', icon: HiOutlineCog6Tooth }
      ]
    : NAV_ITEMS.filter(item => {
        if (item.to === '/admin-dashboard') return hasAnyPermission(['reports.view', 'customers.view']);
        if (item.to === '/dashboard') {
          return isModuleEnabled('products') && hasAnyPermission(['products.view', 'inventory.view']);
        }
        if (item.to === '/crear-producto') {
          return !isCrmRoute && isModuleEnabled('products') && isModuleEnabled('categories') && hasPermission('products.create');
        }
        if (item.to === '/pedidos') return isModuleEnabled('orders') && hasPermission('orders.view');
        if (item.to === '/crm') return isModuleEnabled('crm') && hasPermission('crm.dashboard');
        return true;
      });

  useEffect(() => {
    setIsVisible(true);
    lastScrollYRef.current = typeof window !== 'undefined' ? window.scrollY : 0;
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;
      const delta = currentScrollY - lastScrollY;

      if (currentScrollY <= 24) {
        setIsVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (Math.abs(delta) < 8) {
        return;
      }

      if (delta > 0 && currentScrollY > 96) {
        setIsVisible(false);
      } else if (delta < 0) {
        setIsVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) {
    return null;
  }

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 z-[1050] border-t border-surface-200 bg-white/95 backdrop-blur shadow-brand-sm transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}
    >
      <div className="flex justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 text-[11px] font-medium uppercase tracking-wide transition ${
                isActive ? 'text-brand' : 'text-slate-500 hover:text-brand'
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl border text-base ${
                isActive
                  ? 'border-brand/40 bg-brand/10 text-brand'
                  : 'border-transparent bg-white shadow-sm text-slate-500'
              }`}>
                <Icon aria-hidden="true" />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-red-500 transition hover:text-red-600"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-base">
            <HiOutlineArrowRightOnRectangle aria-hidden="true" />
          </span>
          <span>Salir</span>
        </button>
      </div>
    </nav>
  );
};

export default AdminBottomNav;


