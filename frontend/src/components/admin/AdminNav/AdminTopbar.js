import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HiOutlineBell,
  HiOutlineMagnifyingGlass
} from 'react-icons/hi2';
import axios from '../../../api/axiosInstance';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import { useAuth } from '../../../context/AuthContext';

const routeTitles = {
  '/admin-dashboard': 'Vision general',
  '/dashboard': 'Catalogo de productos',
  '/crear-producto': 'Nuevo producto',
  '/gestionar-categorias': 'Gestion de categorias',
  '/product-private': 'Detalle de producto',
  '/menu-builder': 'Constructor de menu',
  '/crm': 'CRM',
  '/crm/pipeline': 'Pipeline CRM',
  '/crm/contactos': 'Contactos CRM',
  '/crm/tareas': 'Tareas CRM',
  '/crm/carritos-abandonados': 'Recuperacion de carritos',
  '/crm/config': 'Configuracion CRM',
  '/pedidos': 'Pedidos',
  '/ventas/resumen': 'Resumen de ventas'
};

const ORDER_PENDING_STATUS = 'PENDIENTE_PAGO';
const NOTIFICATION_AUTO_HIDE_MS = 8000;
const formatMoney = value =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));

const formatOrderBadgeLabel = order => {
  if (!order) return 'Nuevo pedido';
  if (order.orderNumber) return `#${order.orderNumber}`;
  if (order._id) return `#${String(order._id).slice(-6).toUpperCase()}`;
  return 'Nuevo pedido';
};

const getOrderTimestamp = order => {
  const raw =
    order?.createdAt ||
    order?.created_at ||
    order?.updatedAt ||
    order?.updated_at;
  return raw ? new Date(raw).getTime() : 0;
};

const AdminTopbar = () => {
  const { isModuleEnabled, loading } = usePublicConfig();
  const { hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [notification, setNotification] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const latestOrderRef = useRef({ id: null, timestamp: 0 });
  const pollTimerRef = useRef(null);
  const notificationTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('query') ?? '');
  }, [location.search]);

  const fetchPendingOrders = useCallback(
    async (shouldNotify = true) => {
      try {
        const { data } = await axios.get('/api/orders', { withCredentials: true });
        if (!isMountedRef.current) return;

        const orders = Array.isArray(data) ? data : [];
        const pendingOrders = orders.filter(order => order.status === ORDER_PENDING_STATUS);
        setPendingCount(pendingOrders.length);

        if (!pendingOrders.length) {
          latestOrderRef.current = { id: null, timestamp: 0 };
          if (shouldNotify) {
            setNotification(null);
          }
          return;
        }

        let latestEntry = null;
        pendingOrders.forEach(order => {
          const timestamp = getOrderTimestamp(order);
          if (!latestEntry || timestamp > latestEntry.timestamp) {
            latestEntry = { order, timestamp };
          }
        });

        if (!latestEntry) {
          latestOrderRef.current = { id: null, timestamp: 0 };
          return;
        }

        if (!shouldNotify) {
          latestOrderRef.current = {
            id: latestEntry.order._id ?? null,
            timestamp: latestEntry.timestamp ?? 0
          };
          return;
        }

        const previous = latestOrderRef.current ?? { id: null, timestamp: 0 };
        const hasChanged =
          latestEntry.timestamp > (previous.timestamp ?? 0) ||
          latestEntry.order._id !== previous.id;

        if (hasChanged) {
          latestOrderRef.current = {
            id: latestEntry.order._id ?? null,
            timestamp: latestEntry.timestamp ?? Date.now()
          };

          setNotification({
            id: latestEntry.order._id,
            label: formatOrderBadgeLabel(latestEntry.order),
            customer: latestEntry.order.contactName || latestEntry.order.user?.name || 'Cliente',
            total: latestEntry.order.total ?? latestEntry.order.subtotal ?? null
          });

          if (notificationTimerRef.current) {
            clearTimeout(notificationTimerRef.current);
          }
          notificationTimerRef.current = setTimeout(() => {
            setNotification(null);
            notificationTimerRef.current = null;
          }, NOTIFICATION_AUTO_HIDE_MS);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error monitoreando pedidos nuevos', error);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (loading || !isModuleEnabled('orders') || !hasPermission('orders.view')) {
      setPendingCount(0);
      setNotification(null);
      return undefined;
    }

    isMountedRef.current = true;
    fetchPendingOrders(false);
    pollTimerRef.current = setInterval(() => {
      fetchPendingOrders(true);
    }, 20000);

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, [fetchPendingOrders, hasPermission, isModuleEnabled, loading]);

  const pageTitle = useMemo(() => {
    const match = Object.keys(routeTitles)
      .sort((a, b) => b.length - a.length)
      .find(route => location.pathname.startsWith(route));
    return routeTitles[match] ?? 'Panel administrativo';
  }, [location.pathname]);
  const isCrmRoute = location.pathname.startsWith('/crm');
  const isCatalogRoute =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/crear-producto') ||
    location.pathname.startsWith('/editar-producto');

  const handleSubmit = event => {
    event.preventDefault();
    if (!isCatalogRoute || !isModuleEnabled('inventory') || !hasAnyCatalogVisibility) {
      return;
    }
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      navigate('/dashboard');
      return;
    }
    navigate(`/dashboard?query=${encodeURIComponent(trimmed)}`);
  };

  const notificationBadge = pendingCount > 9 ? '9+' : String(pendingCount);
  const notificationLabel = pendingCount
    ? `Pedidos pendientes: ${pendingCount}`
    : 'Notificaciones recientes';

  const handleDismissNotification = useCallback(() => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }
    setNotification(null);
  }, []);

  const handleNotificationsClick = useCallback(() => {
    if (!isModuleEnabled('orders')) {
      return;
    }
    handleDismissNotification();
    fetchPendingOrders(false);
    navigate('/pedidos');
  }, [fetchPendingOrders, handleDismissNotification, isModuleEnabled, navigate]);

  const inventoryEnabled = isModuleEnabled('inventory');
  const ordersEnabled = isModuleEnabled('orders') && hasPermission('orders.view');
  const hasAnyCatalogVisibility = hasPermission('products.view') || hasPermission('inventory.view');
  const showCatalogSearch = isCatalogRoute && inventoryEnabled && hasAnyCatalogVisibility;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 md:left-72 z-[1050] bg-white/80 backdrop-blur-xl border-b border-surface-200">
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
              Panel administrativo
            </span>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Actualizado en vivo
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            {showCatalogSearch ? (
              <form onSubmit={handleSubmit} className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <HiOutlineMagnifyingGlass className="text-lg" aria-hidden="true" />
                </span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Buscar por nombre, codigo o SKU"
                  className="w-full rounded-xl border border-surface-200 bg-white px-10 py-2.5 text-sm text-slate-600 shadow-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </form>
            ) : (
              <div className="rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm text-slate-500 shadow-sm">
                {isCrmRoute
                  ? 'Trabaja leads, tareas y seguimiento desde este modulo.'
                  : 'Navega el backoffice desde el menu lateral.'}
              </div>
            )}
          </div>

          {ordersEnabled && (
            <div className="flex items-center justify-end">
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={handleNotificationsClick}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-200 text-slate-400 transition hover:border-brand/30 hover:text-brand"
                  aria-label={notificationLabel}
                >
                  <HiOutlineBell className="text-xl" />
                </button>
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white shadow-sm">
                    {notificationBadge}
                  </span>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </header>

      {ordersEnabled && notification && (
        <div
          className="fixed right-4 top-24 z-[1100] w-80 max-w-[92vw] translate-y-0 rounded-2xl border border-brand/20 bg-white/95 p-4 shadow-2xl backdrop-blur-sm transition"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
              <HiOutlineBell className="text-lg" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Nuevo pedido recibido</p>
              <p className="mt-1 text-xs text-slate-600">
                {notification.label}
                {notification.customer ? ` · ${notification.customer}` : ''}
              </p>
              {notification.total != null && (
                <p className="mt-1 text-xs font-semibold text-slate-700">
                  {formatMoney(notification.total)}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleNotificationsClick}
                  className="text-xs font-semibold text-brand hover:text-brand-dark"
                >
                  Ver pedidos
                </button>
                <button
                  type="button"
                  onClick={handleDismissNotification}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600"
                >
                  Ignorar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminTopbar;
