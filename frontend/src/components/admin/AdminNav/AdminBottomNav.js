import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HiOutlineChartPie,
  HiOutlineSquares2X2,
  HiOutlinePlusCircle,
  HiOutlineTag,
  HiOutlineClipboardDocumentList,
  HiOutlineCurrencyDollar,
  HiOutlineInboxStack,
  HiOutlineUsers,
  HiOutlineArrowRightOnRectangle,
  HiOutlineCog6Tooth,
  HiOutlineEllipsisHorizontalCircle
} from 'react-icons/hi2';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import { useAuth } from '../../../context/AuthContext';

const BASE_NAV_ITEMS = [
  { to: '/admin-dashboard', label: 'Inicio', icon: HiOutlineChartPie },
  { to: '/dashboard', label: 'Inventario', icon: HiOutlineSquares2X2 },
  { to: '/crear-producto', label: 'Nuevo', icon: HiOutlinePlusCircle },
  { to: '/gestionar-categorias', label: 'Categorias', icon: HiOutlineTag },
  { to: '/menu-builder', label: 'Menu', icon: HiOutlineClipboardDocumentList },
  { to: '/pedidos', label: 'Pedidos', icon: HiOutlineInboxStack },
  { to: '/crm', label: 'CRM', icon: HiOutlineUsers },
  { to: '/ventas/resumen', label: 'Ventas', icon: HiOutlineCurrencyDollar }
];

const PRIMARY_NAV_TARGETS = [
  '/admin-dashboard',
  '/dashboard',
  '/crear-producto',
  '/pedidos',
  '/crm'
];

const AdminBottomNav = ({ handleLogout, isSuperAdmin = false }) => {
  const location = useLocation();
  const isCrmRoute = location.pathname.startsWith('/crm');
  const { isModuleEnabled, loading } = usePublicConfig();
  const { hasPermission, hasAnyPermission } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const lastScrollYRef = useRef(0);

  const allNavItems = useMemo(() => {
    const filteredBaseItems = BASE_NAV_ITEMS.filter(item => {
      if (item.to === '/admin-dashboard') {
        return hasAnyPermission(['reports.view', 'customers.view']);
      }
      if (item.to === '/dashboard') {
        return isModuleEnabled('products') && hasAnyPermission(['products.view', 'inventory.view']);
      }
      if (item.to === '/crear-producto') {
        return !isCrmRoute && isModuleEnabled('products') && isModuleEnabled('categories') && hasPermission('products.create');
      }
      if (item.to === '/gestionar-categorias') {
        return isModuleEnabled('categories') && hasPermission('categories.manage');
      }
      if (item.to === '/menu-builder') {
        return isModuleEnabled('menu') && hasPermission('menu.manage');
      }
      if (item.to === '/pedidos') {
        return isModuleEnabled('orders') && hasPermission('orders.view');
      }
      if (item.to === '/crm') {
        return isModuleEnabled('crm') && hasPermission('crm.dashboard');
      }
      if (item.to === '/ventas/resumen') {
        return isModuleEnabled('reports') && hasPermission('reports.view');
      }
      return false;
    });

    return isSuperAdmin
      ? [
          ...filteredBaseItems,
          { to: '/super-admin', label: 'Super', icon: HiOutlineCog6Tooth }
        ]
      : filteredBaseItems;
  }, [hasAnyPermission, hasPermission, isCrmRoute, isModuleEnabled, isSuperAdmin]);

  const primaryNavItems = useMemo(
    () =>
      PRIMARY_NAV_TARGETS
        .map(target => allNavItems.find(item => item.to === target))
        .filter(Boolean)
        .slice(0, 4),
    [allNavItems]
  );

  const overflowNavItems = useMemo(
    () => allNavItems.filter(item => !primaryNavItems.some(primary => primary.to === item.to)),
    [allNavItems, primaryNavItems]
  );

  const isMoreMenuActive = overflowNavItems.some(item => location.pathname.startsWith(item.to));

  useEffect(() => {
    setIsVisible(true);
    setIsMoreMenuOpen(false);
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

  useEffect(() => {
    if (!isMoreMenuOpen || typeof document === 'undefined') {
      return undefined;
    }

    const body = document.body;
    body.classList.add('modal-open');
    body.style.overflow = 'hidden';

    return () => {
      body.classList.remove('modal-open');
      body.style.overflow = '';
    };
  }, [isMoreMenuOpen]);

  if (loading) {
    return null;
  }

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 z-[1050] border-t border-surface-200 bg-white/95 backdrop-blur shadow-brand-sm transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}
    >
      <div className="grid grid-cols-5 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {primaryNavItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-w-0 flex-col items-center gap-1 text-[11px] font-medium uppercase tracking-wide transition ${
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
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setIsMoreMenuOpen(true)}
          className={`flex min-w-0 flex-col items-center gap-1 text-[11px] font-medium uppercase tracking-wide transition ${
            isMoreMenuActive || isMoreMenuOpen
              ? 'text-brand'
              : 'text-slate-500 hover:text-brand'
          }`}
          aria-label="Abrir menu completo"
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl border text-base ${
              isMoreMenuActive || isMoreMenuOpen
                ? 'border-brand/40 bg-brand/10 text-brand'
                : 'border-transparent bg-white shadow-sm text-slate-500'
            }`}
          >
            <HiOutlineEllipsisHorizontalCircle aria-hidden="true" />
          </span>
          <span className="truncate">Mas</span>
        </button>
      </div>

      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-[1155] md:hidden">
          <button
            type="button"
            aria-label="Cerrar menu"
            onClick={() => setIsMoreMenuOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white shadow-card-lg">
            <div className="flex max-h-[82vh] flex-col">
              <div className="px-4 pt-4">
                <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-200" />
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Admin</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">Menu completo</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Accesos a categorias, menu, reportes y configuracion.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="rounded-xl border border-surface-200 px-3 py-2 text-sm font-semibold text-slate-600"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="grid gap-3">
                  {overflowNavItems.map(item => {
                    const Icon = item.icon;
                    const isActive = location.pathname.startsWith(item.to);

                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setIsMoreMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                          isActive
                            ? 'border-brand/20 bg-brand/5 text-brand'
                            : 'border-surface-200 bg-white text-slate-700'
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-xl border text-base ${
                            isActive
                              ? 'border-brand/20 bg-white text-brand'
                              : 'border-surface-200 bg-surface-50 text-slate-500'
                          }`}
                        >
                          <Icon aria-hidden="true" />
                        </span>
                        <span className="text-sm font-semibold">{item.label}</span>
                      </Link>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-red-600"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-white text-base text-red-500">
                      <HiOutlineArrowRightOnRectangle aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold">Cerrar sesion</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default AdminBottomNav;


