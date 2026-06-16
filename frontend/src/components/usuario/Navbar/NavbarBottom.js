import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AiOutlineHome } from 'react-icons/ai';
import { FiTag, FiUser } from 'react-icons/fi';
import { HiOutlineShoppingBag } from 'react-icons/hi';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import {
  getGuestOrderTracking,
  subscribeGuestOrderTracking
} from '../../../utils/guestOrderTracking';

const navigationLinks = [
  { to: '/', label: 'Inicio', Icon: AiOutlineHome },
  { to: '/categorias', label: 'Categorias', Icon: FiTag },
  { to: '/cart', label: 'Carrito', Icon: HiOutlineShoppingBag, withBadge: true }
];

const NavbarBottom = () => {
  const { count } = useCart();
  const { isAuthenticated } = useAuth();
  const { isModuleEnabled, loading } = usePublicConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const [isVisible, setIsVisible] = useState(true);
  const [guestOrderTracking, setGuestOrderTracking] = React.useState(() => getGuestOrderTracking());

  const getItemClasses = isActive =>
    `group flex min-w-0 flex-col items-center gap-1 text-center text-[0.68rem] font-semibold leading-tight tracking-[0.03em] transition-colors duration-200 ${
      isActive ? 'text-white drop-shadow-[0_0_10px_rgba(45,212,191,0.36)]' : 'text-white/85 hover:text-white'
    }`;

  const handleProtectedNav = (event, link) => {
    if (link.requiresAuth && !isAuthenticated) {
      event.preventDefault();
      navigate(`/login?redirect=${encodeURIComponent(link.to)}`);
    }
  };
  const sessionItem = isAuthenticated
    ? { key: 'account', to: '/mis-pedidos', label: 'Cuenta', Icon: FiUser, requiresAuth: true }
    : { key: 'login', to: '/login', label: 'Entrar', Icon: FiUser };
  const guestTrackingItem = !isAuthenticated && guestOrderTracking?.lookupToken
    ? { key: 'guest-order', to: `/pedido/${guestOrderTracking.lookupToken}`, label: 'Pedido', Icon: FiUser }
    : null;

  const categoriesEnabled = isModuleEnabled('categories');
  const ordersEnabled = isModuleEnabled('orders');
  const paymentsEnabled = isModuleEnabled('payments');
  const storeItems = navigationLinks.filter(link => {
    if (link.to === '/categorias') return categoriesEnabled && isModuleEnabled('products');
    if (link.to === '/cart') return ordersEnabled && paymentsEnabled;
    return true;
  });
  const navItems = [...storeItems, ...(guestTrackingItem ? [guestTrackingItem] : []), sessionItem];

  useEffect(() => subscribeGuestOrderTracking(setGuestOrderTracking), []);

  useEffect(() => {
    setIsVisible(true);
    lastScrollYRef.current = typeof window !== 'undefined' ? window.scrollY : 0;
  }, [isAuthenticated, guestOrderTracking?.lookupToken, location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleScroll = () => {
      const isMobileViewport = window.innerWidth < 768;
      if (!isMobileViewport) {
        setIsVisible(true);
        lastScrollYRef.current = window.scrollY;
        return;
      }

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
      className={`mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="pointer-events-auto w-full max-w-xl rounded-[2.25rem] border border-white/15 bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-slate-950/95 text-white shadow-[0_25px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <ul
          className="grid items-stretch gap-1 px-2.5 py-3 sm:gap-2 sm:px-4 sm:py-4"
          style={{ gridTemplateColumns }}
        >
          {navItems.map(link => {
            const key = link.to || link.key;

            return (
              <li key={key} className="flex min-w-0 justify-center">
                <NavLink
                  to={link.to}
                  onClick={event => handleProtectedNav(event, link)}
                  className={({ isActive }) => getItemClasses(isActive)}
                >
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/90 transition-all duration-200 group-hover:bg-white/15 group-hover:text-white group-aria-[current=page]:bg-white/15 group-aria-[current=page]:text-white">
                    <link.Icon className="text-[1.35rem]" />
                    {link.withBadge && count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[1.3rem] rounded-full border border-slate-900 bg-teal-400 px-1 text-center text-[10px] font-bold leading-4 text-slate-900">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate">{link.label}</span>
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

