import React, { useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AiOutlineHome } from 'react-icons/ai';
import { FiTag, FiPackage, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import { HiOutlineShoppingBag } from 'react-icons/hi';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { usePublicConfig } from '../../../context/PublicConfigContext';

const navigationLinks = [
  { to: '/', label: 'Inicio', Icon: AiOutlineHome },
  { to: '/categorias', label: 'Categorias', Icon: FiTag },
  { to: '/mis-pedidos', label: 'Pedidos', Icon: FiPackage, requiresAuth: true },
  { to: '/cart', label: 'Carrito', Icon: HiOutlineShoppingBag, withBadge: true }
];

const NavbarBottom = () => {
  const { count } = useCart();
  const { isAuthenticated, isAdmin, isSuperAdmin, logout, hasAnyPermission } = useAuth();
  const { isModuleEnabled, loading } = usePublicConfig();
  const navigate = useNavigate();
  const navRef = useRef(null);

  const getItemClasses = isActive =>
    `group flex flex-col items-center gap-1 text-[0.74rem] font-semibold leading-tight tracking-[0.03em] transition-colors duration-200 ${
      isActive ? 'text-white drop-shadow-[0_0_10px_rgba(45,212,191,0.36)]' : 'text-white/85 hover:text-white'
    }`;

  const handleProtectedNav = (event, link) => {
    if (link.requiresAuth && !isAuthenticated) {
      event.preventDefault();
      navigate(`/login?redirect=${encodeURIComponent(link.to)}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const sessionItem = isAuthenticated
    ? { key: 'logout', label: 'Salir', Icon: FiLogOut, action: handleLogout }
    : { key: 'login', to: '/login', label: 'Entrar', Icon: FiUser };

  const categoriesEnabled = isModuleEnabled('categories');
  const ordersEnabled = isModuleEnabled('orders');
  const paymentsEnabled = isModuleEnabled('payments');
  const canAccessAdmin = hasAnyPermission([
    'reports.view',
    'customers.view',
    'products.view',
    'inventory.view',
    'orders.view',
    'categories.manage',
    'menu.manage'
  ]);
  const adminItem = isSuperAdmin
    ? { to: '/super-admin', label: 'Super', Icon: FiSettings }
    : isAdmin && canAccessAdmin
      ? { to: '/admin-dashboard', label: 'Admin', Icon: FiSettings }
    : null;
  const storeItems = navigationLinks.filter(link => {
    if (link.to === '/categorias') return categoriesEnabled && isModuleEnabled('products');
    if (link.to === '/mis-pedidos') return ordersEnabled;
    if (link.to === '/cart') return ordersEnabled && paymentsEnabled;
    return true;
  });
  const navItems = adminItem
    ? [...storeItems.slice(0, 3), adminItem, ...storeItems.slice(3), sessionItem]
    : [...storeItems, sessionItem];

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const root = document.documentElement;
    const body = document.body;

    const updateOffset = () => {
      if (!navRef.current) return;
      const isMobileViewport = window.innerWidth < 768;

      if (!isMobileViewport) {
        root.style.removeProperty('--mobile-bottom-nav-offset');
        body.classList.remove('has-mobile-bottom-nav');
        return;
      }

      const navHeight = navRef.current.getBoundingClientRect().height || 0;
      const offsetValue = `${Math.ceil(navHeight + 16)}px`;
      root.style.setProperty('--mobile-bottom-nav-offset', offsetValue);
      body.classList.add('has-mobile-bottom-nav');
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);

    return () => {
      window.removeEventListener('resize', updateOffset);
      root.style.removeProperty('--mobile-bottom-nav-offset');
      body.classList.remove('has-mobile-bottom-nav');
    };
  }, [count, isAuthenticated]);

  if (loading) {
    return null;
  }

  const gridTemplateColumns = `repeat(${Math.max(navItems.length, 1)}, minmax(0, 1fr))`;

  return (
    <nav
      ref={navRef}
      className="mobile-bottom-nav md:hidden pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <div className="pointer-events-auto w-full max-w-xl rounded-[2.25rem] border border-white/15 bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-slate-950/95 text-white shadow-[0_25px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <ul
          className="grid items-stretch gap-1.5 px-4 py-3 sm:gap-2 sm:py-4"
          style={{ gridTemplateColumns }}
        >
          {navItems.map(link => {
            const key = link.to || link.key;

            if (link.action) {
              return (
                <li key={key} className="flex justify-center">
                  <button
                    type="button"
                    onClick={link.action}
                    className={`${getItemClasses(false)} whitespace-nowrap hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition-all duration-200 group-hover:bg-rose-400/20 group-hover:text-white">
                      <link.Icon className="text-[1.35rem]" />
                    </span>
                    <span>{link.label}</span>
                  </button>
                </li>
              );
            }

            return (
              <li key={key} className="flex justify-center">
                <NavLink
                  to={link.to}
                  onClick={event => handleProtectedNav(event, link)}
                  className={({ isActive }) => `${getItemClasses(isActive)} whitespace-nowrap`}
                >
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/90 transition-all duration-200 group-hover:bg-white/15 group-hover:text-white group-aria-[current=page]:bg-white/15 group-aria-[current=page]:text-white">
                    <link.Icon className="text-[1.35rem]" />
                    {link.withBadge && count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[1.3rem] rounded-full border border-slate-900 bg-teal-400 px-1 text-center text-[10px] font-bold leading-4 text-slate-900">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </span>
                  <span>{link.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default NavbarBottom;

