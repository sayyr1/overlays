import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from '../../../api/axiosInstance';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import './navbar.css';
import { buildProductFilterUrl } from '../../../utils/productFilters';
import { FiMenu, FiSearch } from 'react-icons/fi';
import { HiOutlineShoppingBag } from 'react-icons/hi';

const createId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const resolveHref = item => {
  if (item.href) return item.href;

  const filters = (() => {
    switch (item.kind) {
      case 'collection': {
        const collection = item.settings?.collection || item.label;
        if (collection) {
          return { collection };
        }
        break;
      }
      case 'filter': {
        const key = item.settings?.filterKey;
        const value = item.settings?.filterValue;
        if (key && value !== undefined && value !== null && value !== '') {
          return { [key]: value };
        }
        break;
      }
      case 'category': {
        const key = item.settings?.filterKey || 'type';
        const value = item.settings?.filterValue ?? item.settings?.category ?? item.label;
        if (value) {
          return { [key]: value };
        }
        break;
      }
      default:
        break;
    }
    return null;
  })();

  if (filters) {
    return buildProductFilterUrl(filters);
  }

  return '/productos';
};

const sortItems = items => [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const isNonEmptyString = v => typeof v === 'string' && v.trim() !== '';
const isItemVisible = item => {
  if (!item || !isNonEmptyString(item.label)) return false;
  if (isNonEmptyString(item.href)) return true;
  const kind = item.kind;
  const s = item.settings || {};
  switch (kind) {
    case 'category':
      return isNonEmptyString(s.filterValue) || isNonEmptyString(s.category);
    case 'collection':
      return isNonEmptyString(s.collection);
    case 'filter':
      return isNonEmptyString(s.filterKey) && isNonEmptyString(s.filterValue);
    case 'link':
    default:
      return false;
  }
};

const NavbarTop = () => {
  const { count } = useCart();
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menu, setMenu] = useState({ rows: [] });
  const [openItemId, setOpenItemId] = useState(null);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [showFloatingMenuToggle, setShowFloatingMenuToggle] = useState(false);
  const [isNavbarHidden, setIsNavbarHidden] = useState(false);
  const hoverTimerRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const navRef = useRef(null);

  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin');

  useEffect(() => {
    const loadMenu = async () => {
      setLoadingMenu(true);
      try {
        const { data } = await axios.get('/api/navigation');
        setMenu({
          title: data.title,
          rows: Array.isArray(data.rows) ? data.rows : []
        });
      } catch (error) {
        console.error('No se pudo cargar el menu de navegacion', error);
        setMenu({
          rows: []
        });
      } finally {
        setLoadingMenu(false);
      }
    };
    loadMenu();
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === 'undefined') return;
      setIsMobileViewport(window.innerWidth < 1024);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === 'undefined') return;
      const current = window.scrollY;
      const last = lastScrollYRef.current ?? 0;
      lastScrollYRef.current = current;

      const threshold = 6;
      const scrollingDown = current > last && current - last > threshold;
      const scrollingUp = current < last && last - current > threshold;

      if (isMobileMenuOpen) {
        setIsNavbarHidden(false);
        if (isMobileViewport) {
          setShowFloatingMenuToggle(true);
        }
        return;
      }

      if (current < 60) {
        setIsNavbarHidden(false);
        setShowFloatingMenuToggle(false);
        return;
      }

      if (scrollingDown) {
        setIsNavbarHidden(true);
      } else if (scrollingUp) {
        setIsNavbarHidden(false);
      }

      if (isMobileViewport) {
        if (scrollingUp) {
          setShowFloatingMenuToggle(true);
        } else if (scrollingDown) {
          setShowFloatingMenuToggle(false);
        }
      } else {
        setShowFloatingMenuToggle(false);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileViewport, isMobileMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || !navRef.current) return undefined;
    const root = document.documentElement;
    const body = document.body;

    const updateOffset = () => {
      if (!navRef.current) return;
      const height = navRef.current.getBoundingClientRect().height || 0;
      root.style.setProperty('--navbar-top-offset', `${Math.ceil(height)}px`);
    };

    body.classList.add('has-sticky-navbar');
    updateOffset();
    window.addEventListener('resize', updateOffset);

    let resizeObserver = null;
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(updateOffset);
      resizeObserver.observe(navRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateOffset);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      root.style.removeProperty('--navbar-top-offset');
      body.classList.remove('has-sticky-navbar');
    };
  }, [isMobileMenuOpen, menu.rows.length, loadingMenu, isAuthenticated, isAdmin]);

  const highlightRows = useMemo(
    () => menu.rows.filter(row => row.type === 'highlight'),
    [menu.rows]
  );

  const categoryRows = useMemo(() => {
    const rows = menu.rows.filter(row => row.type === 'category');
    return rows
      .map(row => ({
        ...row,
        items: Array.isArray(row.items) ? row.items.filter(isItemVisible) : []
      }))
      .filter(row => row.items.length > 0);
  }, [menu.rows]);

  const highlightItems = useMemo(
    () => highlightRows.flatMap(row => sortItems(row.items || [])),
    [highlightRows]
  );

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const handleMouseEnter = itemId => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setOpenItemId(itemId);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setOpenItemId(null);
    }, 120);
  };

  const floatingToggleVisible = isMobileViewport && (showFloatingMenuToggle || isMobileMenuOpen);
  const floatingToggleClasses = `lg:hidden fixed right-4 top-4 z-[60] inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-slate-900/95 text-white shadow-lg shadow-black/40 transition-all duration-200 ${
    floatingToggleVisible ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-2'
  }`;
  const navTransformClasses = isNavbarHidden ? '-translate-y-full' : 'translate-y-0';
  const navScrollClasses = isMobileViewport && isMobileMenuOpen ? 'max-h-screen overflow-y-auto' : '';

  return (
    <>
      <nav
        ref={navRef}
        className={`fixed left-0 right-0 top-0 z-50 w-full transform-gpu bg-transparent shadow-brand-sm transition-transform duration-300 ease-in-out ${navTransformClasses} ${navScrollClasses}`}
      >
      <div className="bg-brand text-white">



          
          {/* PARA AGREGAR CAMPA;AS DE NUEVAS coleccionES O PROMOCIONES AQUI */}

          
              {/* <div className="container mx-auto flex flex-col gap-1 px-4 py-2 text-xs font-medium sm:flex-row sm:items-center sm:justify-between">
          <span className="uppercase tracking-[0.35em] text-white/70">
            Nueva coleccion Street Realism
          </span>
          <Link
            to="/productos?collection=Street+Realism"
            className="inline-flex items-center gap-2 font-semibold uppercase tracking-wide text-white hover:text-white/90"
          >
            Descubrela ahora
            <span aria-hidden="true">-></span>
          </Link>
        </div> */}
      </div>

      <div className="navbar-top-custom bg-slate-900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col">
            <div className="flex items-center justify-between py-3 lg:hidden">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={toggleMobileMenu}
                  className="flex items-center justify-center rounded-md p-2 text-white transition-colors duration-150 hover:text-brand"
                  aria-label={isMobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
                >
                  <FiMenu className={`text-2xl ${isMobileMenuOpen ? 'text-brand' : 'text-white'}`} />
                </button>
              </div>

              <Link to="/" className="flex-1 text-center" aria-label="Volver al inicio">
                <span className="text-white text-xl font-extrabold uppercase tracking-[0.3em]">
                  Niway Store
                  
                </span>
              </Link>
              

              {/* <div className="flex items-center gap-4">
                <Link
                  to="/productos"
                  className="relative text-white transition-colors duration-150 hover:text-brand"
                  aria-label="Buscar productos"
                >
                  <FiSearch className="text-2xl" />
                </Link>
                <Link
                  to="/cart"
                  className="relative text-white transition-colors duration-150 hover:text-brand"
                  aria-label="Ver carrito"
                >
                  <HiOutlineShoppingBag className="text-2xl" />
                  {count > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[1.2rem] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-4 text-black">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </Link>
              </div> */}
            </div>

            <div className="hidden lg:flex items-center justify-between py-4 gap-4">
              <Link to="/" className="flex-shrink-0" aria-label="Volver al inicio">
                <span className="text-white text-3xl font-extrabold tracking-wide drop-shadow-sm uppercase">
Niway Store                </span>
              </Link>

              <div className="flex flex-1 justify-center">
                <ul className="flex items-center gap-6 text-sm uppercase tracking-wide">
                  {loadingMenu && (
                    <li className="text-white/60 text-xs">Cargando menu...</li>
                  )}
                  {!loadingMenu && highlightItems.length === 0 && (
                    <li>
                      <Link
                        className="hover:text-brand transition-colors duration-200"
                        to="/productos"
                      >
                        Categorias
                      </Link>
                    </li>
                  )}
                  {highlightItems.map((item, index) => {
                    const href = resolveHref(item);
                    return (
                      <li key={item.id || `highlight-${index}`}>
                        <Link
                          to={href}
                          className="hover:text-brand transition-colors duration-150"
                        >
                          {item.label}
                          {item.badge && (
                            <span className="ml-2 rounded bg-brand px-2 py-0.5 text-[11px] uppercase tracking-wider">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <Link
                  to="/cart"
                  className="hover:text-brand transition-colors duration-150"
                >
                  Carrito {count > 0 ? `(${count})` : ''}
                </Link>
                {!isAuthenticated ? (
                  <Link
                    to="/login?redirect=/"
                    className="rounded-full border border-white/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-slate-900"
                  >
                    Inicia sesion / Registrate
                  </Link>
                ) : (
                  <>
                    {isAdmin && (
                      <Link
                        to="/admin-dashboard"
                        className="hover:text-brand transition-colors duration-150"
                      >
                        Admin
                      </Link>
                    )}
                    <Link
                      to="/mis-pedidos"
                      className="hover:text-brand transition-colors duration-150"
                    >
                      Mis pedidos
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-slate-900"
                    >
                      Cerrar sesion
                    </button>
                  </>
                )}
              </div>
            </div>

            <div
              className={`lg:hidden overflow-hidden border-t border-white/10 transition-all duration-200 ease-in-out ${isMobileMenuOpen ? 'max-h-[75vh] opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <div className="py-3 space-y-4">
                {highlightItems.length > 0 && (
                  <div className="flex items-center gap-3 overflow-x-auto text-xs uppercase tracking-wide whitespace-nowrap px-1">
                    {highlightItems.map((item, index) => {
                      const href = resolveHref(item);
                      return (
                        <Link
                          key={item.id || `chip-${index}`}
                          to={href}
                          className="rounded-full border border-white/30 px-4 py-1 text-white hover:bg-white hover:text-black transition-colors duration-150"
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {categoryRows.length > 0 && (
                  <div className="divide-y divide-white/10">
                    {categoryRows.map((row, rowIndex) => {
                      const visibleItems = sortItems(row.items || []);
                      return (
                        <details key={row.id || `mobile-row-${rowIndex}`} className="py-3">
                          <summary className="text-sm font-semibold uppercase tracking-wide text-white/90 cursor-pointer">
                            {row.title || 'Categorias'}
                          </summary>
                          <div className="mt-2 space-y-3 text-sm">
                            {visibleItems.map((item, itemIndex) => {
                              const href = resolveHref(item);
                              const subItems = (item.megaMenu?.columns || []).flatMap(column => column.items || []);
                              return (
                                <div key={item.id || `mobile-item-${rowIndex}-${itemIndex}`} className="space-y-1">
                                  <Link to={href} className="block text-white hover:text-brand">
                                  {item.label}
                                  {item.badge && (
                                    <span className="ml-2 rounded bg-brand px-2 py-0.5 text-[11px] uppercase tracking-wider">
                                      {item.badge}
                                    </span>
                                  )}
                                  </Link>
                                  {subItems.length > 0 && (
                                    <ul className="pl-4 space-y-1 text-xs text-white/70">
                                      {subItems.map((columnItem, subIndex) => (
                                        <li key={columnItem.id || `mobile-sub-${rowIndex}-${itemIndex}-${subIndex}`}>
                                          <Link
                                            to={columnItem.href || '#'}
                                            className="hover:text-brand transition-colors duration-150"
                                          >
                                            {columnItem.label}
                                            {columnItem.badge && (
                                              <span className="ml-2 rounded bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                                {columnItem.badge}
                                              </span>
                                            )}
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                            );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {categoryRows.length > 0 && (
              <div className="hidden lg:flex items-center justify-center gap-8 py-3 border-t border-white/10">
                {categoryRows.map(row => {
                  const visibleItems = sortItems(row.items || []);
                  return visibleItems.map((item, index) => {
                    const href = resolveHref(item);
                    const hasMega = item.megaMenu && (item.megaMenu.columns || []).length > 0;

                    return (
                      <div
                        key={item.id || `category-${index}`}
                        className="relative"
                        onMouseEnter={() => hasMega && handleMouseEnter(item.id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <Link
                          to={href}
                          className="uppercase tracking-wide text-sm hover:text-brand transition-colors duration-150"
                        >
                          {item.label}
                          {item.badge && (
                            <span className="ml-2 rounded bg-brand px-2 py-0.5 text-[11px] uppercase tracking-wider">
                              {item.badge}
                            </span>
                          )}
                        </Link>

                        {hasMega && openItemId === item.id && (
                          <MegaMenuPanel item={item} onClose={handleMouseLeave} />
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      </nav>
     
    </>
  );
};

const MegaMenuPanel = ({ item, onClose }) => (
  <div
    className="absolute left-1/2 top-full z-40 mt-2 w-[860px] -translate-x-1/2 rounded-xl bg-white p-6 text-black shadow-2xl"
    onMouseLeave={onClose}
  >
    <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
      {(item.megaMenu?.columns || []).map((column, columnIndex) => (
        <div key={column.id || `column-${columnIndex}`} className="space-y-3">
          {column.title && (
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {column.title}
            </h4>
          )}
          <ul className="space-y-2 text-sm">
            {(column.items || []).map((columnItem, columnItemIndex) => {
              const href = columnItem.href || '#';
              return (
                <li key={columnItem.id || `column-item-${columnIndex}-${columnItemIndex}`}>
                  <Link
                    to={href}
                    className="flex items-center justify-between text-slate-600 hover:text-brand transition-colors duration-150"
                  >
                    <span>{columnItem.label}</span>
                    {columnItem.badge && (
                      <span className="ml-2 rounded bg-black px-2 py-0.5 text-[11px] uppercase tracking-wide text-white">
                        {columnItem.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {item.megaMenu?.featured && (
        <div className="col-span-3 rounded-lg border border-surface-200 p-4 md:col-span-1 md:row-span-full bg-surface-50">
          {item.megaMenu.featured.imageUrl && (
            <img
              src={item.megaMenu.featured.imageUrl}
              alt={item.megaMenu.featured.title || 'Destacado'}
              className="mb-3 h-40 w-full rounded-md object-cover"
            />
          )}
          <h4 className="text-base font-semibold mb-1">
            {item.megaMenu.featured.title}
          </h4>
          <p className="text-sm text-slate-500 mb-3">
            {item.megaMenu.featured.description}
          </p>
          {item.megaMenu.featured.href && (
            <Link
              to={item.megaMenu.featured.href}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark"
            >
              Ver mas
              <span aria-hidden="true">-></span>
            </Link>
          )}
        </div>
      )}
    </div>
  </div>
);

export default NavbarTop;
