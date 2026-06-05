import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from '../../../api/axiosInstance';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import './navbar.css';
import {
  getGuestOrderTracking,
  subscribeGuestOrderTracking
} from '../../../utils/guestOrderTracking';
import { buildProductFilterUrl } from '../../../utils/productFilters';
import { FiChevronRight, FiMenu, FiSearch, FiX } from 'react-icons/fi';
import { HiOutlineShoppingBag } from 'react-icons/hi';
import LogoBg from '../../../assets/images/background.png';

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

const buildStoreSearchUrl = term => {
  const normalized = String(term || '').trim();
  if (!normalized) return '/productos';
  const params = new URLSearchParams();
  params.set('search', normalized);
  return `/productos?${params.toString()}`;
};

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
  const { isAuthenticated, logout, user, isSuperAdmin, hasAnyPermission } = useAuth();
  const { branding, storeName, loading, isModuleEnabled } = usePublicConfig();
  const navigate = useNavigate();
  const location = useLocation();

  const [menu, setMenu] = useState({ rows: [] });
  const [openItemId, setOpenItemId] = useState(null);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isNavbarHidden, setIsNavbarHidden] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [guestOrderTracking, setGuestOrderTracking] = useState(() => getGuestOrderTracking());
  const hoverTimerRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const navRef = useRef(null);

  const isAdmin = Boolean(user?.isAdmin || ['sales', 'owner', 'admin', 'superadmin'].includes(user?.role));
  const canAccessAdmin = hasAnyPermission([
    'reports.view',
    'customers.view',
    'products.view',
    'inventory.view',
    'orders.view',
    'categories.manage',
    'menu.manage'
  ]);
  const brandLogo = branding?.logoUrl || LogoBg;
  const brandName = storeName;
  const productsEnabled = isModuleEnabled('products');
  const categoriesEnabled = isModuleEnabled('categories');
  const ordersEnabled = isModuleEnabled('orders');
  const paymentsEnabled = isModuleEnabled('payments');
  const menuEnabled = isModuleEnabled('menu');
  const guestTrackingHref = guestOrderTracking?.lookupToken
    ? `/pedido/${guestOrderTracking.lookupToken}`
    : '';

  useEffect(() => subscribeGuestOrderTracking(setGuestOrderTracking), []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!menuEnabled || !productsEnabled) {
      setMenu({ rows: [] });
      setLoadingMenu(false);
      return;
    }

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
  }, [loading, menuEnabled, productsEnabled]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('search') || '');
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
        return;
      }

      if (current < 60) {
        setIsNavbarHidden(false);
        return;
      }

      if (scrollingDown) {
        setIsNavbarHidden(true);
      } else if (scrollingUp) {
        setIsNavbarHidden(false);
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
    () => (menuEnabled ? menu.rows.filter(row => row.type === 'highlight') : []),
    [menu.rows, menuEnabled]
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

  const mobileBrowseItems = useMemo(() => {
    const categoryItems = categoryRows.flatMap(row => sortItems(row.items || []));
    const baseItems = categoryItems.length > 0 ? categoryItems : highlightItems;
    const deduped = [];
    const seen = new Set();

    baseItems.forEach(item => {
      const key = `${item.kind || 'link'}:${item.label}:${resolveHref(item)}`;
      if (!seen.has(key) && isItemVisible(item)) {
        seen.add(key);
        deduped.push({
          id: item.id || key,
          label: item.label,
          href: resolveHref(item)
        });
      }
    });

    if (!deduped.some(item => item.href === '/productos')) {
      deduped.unshift({ id: 'browse-all', label: 'Todo', href: '/productos' });
    }

    return deduped.slice(0, 14);
  }, [categoryRows, highlightItems]);

  const mobileSupportLinks = useMemo(
    () => ([
      { id: 'about', label: 'Sobre la tienda', href: '/' },
      { id: 'how-it-works', label: 'Como comprar', href: '/productos' },
      { id: 'new-releases', label: 'Nuevos lanzamientos', href: '/productos?onSale=true' },
      { id: 'news', label: 'Noticias', href: '/productos' }
    ]),
    []
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

  const submitSearch = event => {
    event.preventDefault();
    navigate(buildStoreSearchUrl(searchTerm));
    setIsMobileMenuOpen(false);
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

  const navTransformClasses = isNavbarHidden ? '-translate-y-full' : 'translate-y-0';
  const navScrollClasses = '';

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

      <div className="navbar-top-custom border-b border-white/10 bg-[#171717] text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col">
            <div className="flex items-center justify-between py-2.5 lg:hidden">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleMobileMenu}
                  className="flex items-center justify-center rounded-md p-2 text-white transition-colors duration-150 hover:text-brand"
                  aria-label={isMobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
                >
                  <FiMenu className={`text-2xl ${isMobileMenuOpen ? 'text-brand' : 'text-white'}`} />
                </button>
                {ordersEnabled && paymentsEnabled && (
                  <Link
                    to="/cart"
                    className="relative inline-flex items-center justify-center rounded-md p-2 text-white transition-colors duration-150 hover:text-brand"
                    aria-label="Ver carrito"
                  >
                    <HiOutlineShoppingBag className="text-2xl" />
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[1.1rem] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-4 text-slate-950">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </Link>
                )}
              </div>

              <Link to="/" className="flex-1 flex items-center justify-center gap-2" aria-label="Volver al inicio">
                <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 shadow">
                  <img src={brandLogo} alt="Logo" className="h-full w-full object-cover" />
                </span>
                <span className="text-white text-lg font-extrabold uppercase tracking-[0.18em]">{brandName}</span>
              </Link>
              <Link
                to={buildStoreSearchUrl(searchTerm)}
                className="inline-flex items-center justify-center rounded-md p-2 text-white transition-colors duration-150 hover:text-brand"
                aria-label="Buscar productos"
              >
                <FiSearch className="text-2xl" />
              </Link>
            </div>

            <div className="hidden lg:flex items-center justify-between py-3 gap-4">
              <Link to="/" className="flex items-center gap-3 flex-shrink-0" aria-label="Volver al inicio">
                <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 shadow">
                  <img src={brandLogo} alt="Logo" className="h-full w-full object-cover" />
                </span>
                <span className="text-brand text-2xl font-extrabold tracking-tight">{brandName}</span>
              </Link>

              <div className="flex flex-1 items-center gap-4">
                <form
                  onSubmit={submitSearch}
                  className="flex min-w-[280px] max-w-3xl flex-1 items-center gap-3 rounded-md border border-white/15 bg-[#232323] px-4 py-2"
                >
                  <FiSearch className="text-base text-white/55" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    placeholder="Buscar productos, marca o colección"
                    className="w-full bg-transparent text-sm text-white placeholder:text-white/45 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-[#2d2d2d] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-brand hover:text-slate-950"
                  >
                    Buscar
                  </button>
                </form>

                <ul className="flex items-center gap-4 text-[11px] uppercase tracking-wide">
                  {loadingMenu && (
                    <li className="text-white/60 text-xs">Cargando menu...</li>
                  )}
                  {!loadingMenu && productsEnabled && categoriesEnabled && highlightItems.length === 0 && (
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
                {ordersEnabled && paymentsEnabled && (
                  <Link
                    to="/cart"
                    className="inline-flex items-center gap-2 hover:text-brand transition-colors duration-150"
                  >
                    <HiOutlineShoppingBag className="text-lg" />
                    Carrito {count > 0 ? `(${count})` : ''}
                  </Link>
                )}
                {!isAuthenticated ? (
                  <>
                    {ordersEnabled && guestTrackingHref && (
                      <Link
                        to={guestTrackingHref}
                        className="hover:text-brand transition-colors duration-150"
                      >
                        Seguir pedido
                      </Link>
                    )}
                    <Link
                      to="/login?redirect=/"
                      className="rounded-full border border-white/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-slate-900"
                    >
                      Inicia sesion / Registrate
                    </Link>
                  </>
                ) : (
                  <>
                    {isAdmin && canAccessAdmin && (
                      <Link
                        to="/admin-dashboard"
                        className="hover:text-brand transition-colors duration-150"
                      >
                        Admin
                      </Link>
                    )}
                    {isSuperAdmin && (
                      <Link
                        to="/super-admin"
                        className="hover:text-brand transition-colors duration-150"
                      >
                        Super Admin
                      </Link>
                    )}
                    {ordersEnabled && (
                      <Link
                        to="/mis-pedidos"
                        className="hover:text-brand transition-colors duration-150"
                      >
                        Mis pedidos
                      </Link>
                    )}
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

            {categoryRows.length > 0 && (
              <div className="hidden lg:flex items-center justify-center gap-6 py-2.5 border-t border-white/10 text-[12px]">
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
                          className="inline-flex items-center gap-1.5 uppercase tracking-wide text-sm hover:text-brand transition-colors duration-150"
                        >
                          <span>{item.label}</span>
                          {hasMega && (
                            <FiChevronRight className="text-[13px] opacity-55" />
                          )}
                          {item.badge && (
                            <span className="ml-1 rounded bg-brand px-2 py-0.5 text-[11px] uppercase tracking-wider text-slate-950">
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

      {isMobileMenuOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px]"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Cerrar menu"
          />
          <aside className="fixed inset-y-0 left-0 z-[60] w-[88vw] max-w-[395px] overflow-y-auto border-r border-white/10 bg-[#171717] text-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#171717]">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center text-white/85 transition hover:text-white"
                  aria-label="Cerrar menu"
                >
                  <FiX className="text-2xl" />
                </button>
                <Link
                  to="/"
                  className="flex items-center gap-2 text-brand"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Volver al inicio"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 shadow">
                    <img src={brandLogo} alt="Logo" className="h-full w-full object-cover" />
                  </span>
                  <span className="text-2xl font-extrabold tracking-tight">{brandName}</span>
                </Link>
                <span className="h-9 w-9" aria-hidden="true" />
              </div>
              <div className="flex items-center justify-between border-t border-white/10 bg-[#111111] px-4 py-3">
                <span className="text-xl font-semibold text-white">Explorar</span>
                <Link
                  to="/productos"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-semibold text-brand hover:text-white"
                >
                  Ver todo
                </Link>
              </div>
            </div>

            <div className="border-b border-white/10 bg-[#232323]">
              {mobileBrowseItems.map(item => (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-4 text-[1.05rem] font-semibold text-white transition hover:bg-white/5"
                >
                  <span>{item.label}</span>
                  <FiChevronRight className="text-white/75" />
                </Link>
              ))}
            </div>

            <div className="bg-[#111111] py-2">
              {mobileSupportLinks.map(link => (
                <Link
                  key={link.id}
                  to={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-4 text-[1.02rem] font-semibold text-white transition hover:bg-white/5"
                >
                  <span>{link.label}</span>
                  <FiChevronRight className="text-white/75" />
                </Link>
              ))}

              {ordersEnabled && isAuthenticated && (
                <Link
                  to="/mis-pedidos"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-4 text-[1.02rem] font-semibold text-white transition hover:bg-white/5"
                >
                  <span>Mis pedidos</span>
                  <FiChevronRight className="text-white/75" />
                </Link>
              )}

              {ordersEnabled && !isAuthenticated && guestTrackingHref && (
                <Link
                  to={guestTrackingHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-4 text-[1.02rem] font-semibold text-white transition hover:bg-white/5"
                >
                  <span>Seguir pedido</span>
                  <FiChevronRight className="text-white/75" />
                </Link>
              )}

              {isAdmin && canAccessAdmin && (
                <Link
                  to="/admin-dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-4 text-[1.02rem] font-semibold text-white transition hover:bg-white/5"
                >
                  <span>Admin</span>
                  <FiChevronRight className="text-white/75" />
                </Link>
              )}

              {isSuperAdmin && (
                <Link
                  to="/super-admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-4 text-[1.02rem] font-semibold text-white transition hover:bg-white/5"
                >
                  <span>Super Admin</span>
                  <FiChevronRight className="text-white/75" />
                </Link>
              )}

              {!isAuthenticated ? (
                <Link
                  to="/login?redirect=/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-4 text-[1.02rem] font-semibold text-white transition hover:bg-white/5"
                >
                  <span>Inicia sesion</span>
                  <FiChevronRight className="text-white/75" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-4 py-4 text-left text-[1.02rem] font-semibold text-white transition hover:bg-white/5"
                >
                  <span>Cerrar sesion</span>
                  <FiChevronRight className="text-white/75" />
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
     
    </>
  );
};

const MegaMenuPanel = ({ item, onClose }) => {
  const columns = useMemo(() => sortItems(item.megaMenu?.columns || []), [item.megaMenu?.columns]);
  const [activeColumnId, setActiveColumnId] = useState(columns[0]?.id || null);

  useEffect(() => {
    setActiveColumnId(columns[0]?.id || null);
  }, [columns]);

  const activeColumn = useMemo(
    () => columns.find(column => column.id === activeColumnId) || columns[0] || null,
    [activeColumnId, columns]
  );

  const secondaryColumns = useMemo(
    () => columns.filter(column => column.id !== activeColumn?.id).slice(0, 2),
    [activeColumn?.id, columns]
  );

  return (
    <div
      className="absolute left-1/2 top-full z-40 mt-2 w-[1040px] max-w-[calc(100vw-3rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#232320] text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)]"
      onMouseLeave={onClose}
    >
      <div className="grid min-h-[360px] grid-cols-[240px_minmax(0,1fr)_320px]">
        <div className="border-r border-white/8 bg-[#2b2b27] px-3 py-4">
          <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
            Explorar
          </div>
          <div className="space-y-1.5">
            {columns.map((column, columnIndex) => {
              const isActive = column.id === activeColumn?.id;
              return (
                <button
                  key={column.id || `column-tab-${columnIndex}`}
                  type="button"
                  onMouseEnter={() => setActiveColumnId(column.id)}
                  onFocus={() => setActiveColumnId(column.id)}
                  onClick={() => setActiveColumnId(column.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] font-semibold transition ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/78 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{column.title || `Grupo ${columnIndex + 1}`}</span>
                  <FiChevronRight className={`text-base transition ${isActive ? 'text-brand' : 'text-white/45'}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/8 pb-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                {item.label}
              </div>
              <h4 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {activeColumn?.title || item.label}
              </h4>
            </div>
            <Link
              to={resolveHref(item)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/88 transition hover:border-brand/40 hover:text-brand"
            >
              Ver todo
              <FiChevronRight className="text-base" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {(activeColumn?.items || []).map((columnItem, columnItemIndex) => {
              const href = columnItem.href || '#';
              return (
                <Link
                  key={columnItem.id || `column-item-${columnItemIndex}`}
                  to={href}
                  className="group flex items-center justify-between rounded-xl border border-transparent bg-white/[0.03] px-4 py-3 text-sm text-white/78 transition hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
                >
                  <span className="pr-3 font-medium leading-tight">{columnItem.label}</span>
                  <span className="flex items-center gap-2">
                    {columnItem.badge && (
                      <span className="rounded-full border border-brand/35 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand">
                        {columnItem.badge}
                      </span>
                    )}
                    <FiChevronRight className="text-base text-white/35 transition group-hover:text-brand" />
                  </span>
                </Link>
              );
            })}
          </div>

          {secondaryColumns.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/8 pt-5">
              {secondaryColumns.map((column, secondaryIndex) => (
                <div
                  key={column.id || `secondary-column-${secondaryIndex}`}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                    {column.title || `Grupo ${secondaryIndex + 1}`}
                  </div>
                  <div className="space-y-2">
                    {(column.items || []).slice(0, 3).map((columnItem, linkIndex) => (
                      <Link
                        key={columnItem.id || `secondary-link-${secondaryIndex}-${linkIndex}`}
                        to={columnItem.href || '#'}
                        className="flex items-center justify-between text-sm text-white/72 transition hover:text-white"
                      >
                        <span>{columnItem.label}</span>
                        <FiChevronRight className="text-white/35" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-l border-white/8 bg-[#1d1d1a] p-5">
          {item.megaMenu?.featured ? (
            <div className="flex h-full flex-col rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
              {item.megaMenu.featured.imageUrl && (
                <img
                  src={item.megaMenu.featured.imageUrl}
                  alt={item.megaMenu.featured.title || 'Destacado'}
                  className="mb-4 h-48 w-full rounded-[1rem] object-cover"
                />
              )}
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                Destacado
              </div>
              <h4 className="mt-2 text-2xl font-semibold leading-tight text-white">
                {item.megaMenu.featured.title || item.label}
              </h4>
              <p className="mt-3 text-sm leading-6 text-white/65">
                {item.megaMenu.featured.description || 'Destaca una campaña, colección o acceso rápido desde el builder.'}
              </p>
              {item.megaMenu.featured.href && (
                <Link
                  to={item.megaMenu.featured.href}
                  className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-brand transition hover:text-white"
                >
                  Ver mas
                  <FiChevronRight className="text-base" />
                </Link>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col justify-between rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.02] p-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                  Acceso rapido
                </div>
                <h4 className="mt-2 text-2xl font-semibold leading-tight text-white">
                  {item.label}
                </h4>
                <p className="mt-3 text-sm leading-6 text-white/65">
                  Este panel puede usarse para promos, editoriales o bloques visuales de cualquier negocio.
                </p>
              </div>
              <Link
                to={resolveHref(item)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-white"
              >
                Ir a la seccion
                <FiChevronRight className="text-base" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NavbarTop;
