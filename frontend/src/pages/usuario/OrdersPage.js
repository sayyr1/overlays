import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { formatCurrency } from '../../utils/pricing';
import { ORDER_HOLD_LABEL } from '../../utils/orderConstants';
import {
  formatOrderStatus,
  getOrderStatusBadgeClass
} from '../../utils/orderStatus';

const formatDateTime = value => {
  if (!value) return 'S/D';
  return new Date(value).toLocaleString();
};

const orderCode = order => order?.orderNumber ?? order?._id?.slice(-6) ?? 's/n';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const location = useLocation();
  const { paymentMethods, textMap, settings } = usePublicConfig();

  const highlightOrderId = location.state?.highlightOrder ?? null;
  const highlightOrderNumber = Number(highlightOrderId);
  const hasNumericHighlight = !Number.isNaN(highlightOrderNumber);
  const activePaymentMethods = useMemo(
    () => (paymentMethods || []).filter(method => method.enabled),
    [paymentMethods]
  );
  const sanitizedPhone = useMemo(() => {
    const candidate = settings?.whatsapp || '';
    return String(candidate).replace(/\D/g, '');
  }, [settings?.whatsapp]);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get('/api/orders/mine', { withCredentials: true });
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('No pudimos cargar tus pedidos. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const pendingOrders = useMemo(
    () => orders.filter(order => order.status === 'PENDIENTE_PAGO'),
    [orders]
  );

  const recentOrders = useMemo(
    () => orders.filter(order => order.status !== 'PENDIENTE_PAGO'),
    [orders]
  );

  const getWhatsappLink = order => {
    if (!sanitizedPhone) return null;
    const total = order.total ?? order.subtotal;
    const message = `Hola, mi pedido es #${orderCode(order)} por ${formatCurrency(total)}.`;
    return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Mis pedidos</h1>
            <p className="text-sm text-slate-500">
              Revisa el estado de tus reservas, sube comprobantes y sigue la linea de tiempo de cada pedido.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchOrders}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand"
          >
            Actualizar
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-surface-200 bg-white p-10 text-center text-slate-500 shadow-brand-sm">
            Cargando pedidos...
          </div>
        ) : !orders.length ? (
          <div className="rounded-3xl border border-surface-200 bg-white p-10 text-center shadow-brand-sm">
            <h2 className="text-xl font-semibold text-slate-800">Aun no registras pedidos</h2>
            <p className="mt-2 text-sm text-slate-500">Explora el catalogo y crea tu primer reserva.</p>
            <Link
              to="/productos"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-brand-sm transition hover:bg-brand-dark"
            >
              Ver productos
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {pendingOrders.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Pendientes de pago</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {pendingOrders.map(order => {
                    const whatsappLink = getWhatsappLink(order);
                    const highlight = highlightOrderId && (order._id === highlightOrderId || (hasNumericHighlight && order.orderNumber === highlightOrderNumber));
                    return (
                      <article
                        key={order._id}
                        className={`surface-card flex flex-col gap-4 p-5 ${highlight ? 'ring-2 ring-brand' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Pedido</p>
                            <h3 className="text-xl font-semibold text-slate-900">#{orderCode(order)}</h3>
                            <p className="text-xs text-slate-500">Creado el {formatDateTime(order.createdAt)}</p>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusBadgeClass(order.status)}`}>
                            {formatOrderStatus(order.status)}
                          </span>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                          Confirma tu deposito dentro de las proximas {ORDER_HOLD_LABEL}. Pasada la fecha limite la reserva se libera automaticamente.
                          {order.expiresAt && (
                            <p className="mt-1 text-xs text-amber-600">
                              Expira el {formatDateTime(order.expiresAt)}.
                            </p>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 space-y-1">
                          <p><strong>Total:</strong> {formatCurrency(order.total ?? order.subtotal)}</p>
                          <p><strong>Contacto:</strong> {order.contactName || 'Sin dato'} - {order.contactPhone || 'S/D'}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Productos</h4>
                          <ul className="space-y-1 text-sm text-slate-600">
                            {order.items.map(item => (
                              <li key={`${order._id}-${item.product}-${item.size}-${item.color}`}>
                                {item.quantity} x {item.title} {item.size ? `- Talla ${item.size}` : ''} {item.color ? `- ${item.color}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-surface-100 px-4 py-3 text-sm text-slate-600">
                          <p className="font-semibold text-slate-800">Metodos de pago activos</p>
                          {activePaymentMethods.length ? (
                            activePaymentMethods.map(method => (
                              <div key={method._id} className="mt-2 rounded-lg border border-surface-200 bg-white px-3 py-2">
                                <p className="font-medium text-slate-800">{method.name}</p>
                                {method.instructions && <p>{method.instructions}</p>}
                                {method.bankName && <p>Banco: {method.bankName}</p>}
                                {method.accountNumber && <p>Cuenta: {method.accountNumber}</p>}
                                {method.accountOwner && <p>Titular: {method.accountOwner}</p>}
                                {method.accountId && <p>Identificacion: {method.accountId}</p>}
                              </div>
                            ))
                          ) : (
                            <p className="mt-2">No hay metodos de pago configurados actualmente.</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          {whatsappLink && (
                            <a
                              href={whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex flex-1 items-center justify-center rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition"
                            >
                              Confirmar por WhatsApp
                            </a>
                          )}
                          <Link
                            to="/productos"
                            className="inline-flex flex-1 items-center justify-center rounded-full border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:text-brand hover:border-brand/40 transition"
                          >
                            Seguir comprando
                          </Link>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Estado</h4>
                          <ul className="text-xs text-slate-500">
                            {order.statusHistory?.map((entry, index) => (
                              <li key={`${order._id}-pending-history-${index}`}>
                                <span className="font-semibold text-slate-600">{formatOrderStatus(entry.status)}:</span> {formatDateTime(entry.changedAt)}
                                {entry.note ? ` - ${entry.note}` : ''}
                              </li>
                            )) || <li>Sin historial</li>}
                          </ul>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {recentOrders.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Historial</h2>
                <div className="space-y-4">
                  {recentOrders.map(order => (
                    <article
                      key={order._id}
                      className={`surface-card flex flex-col gap-4 p-5 ${highlightOrderId && (order._id === highlightOrderId || (hasNumericHighlight && order.orderNumber === highlightOrderNumber)) ? 'ring-2 ring-brand' : ''}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Pedido</p>
                          <h3 className="text-xl font-semibold text-slate-900">#{orderCode(order)}</h3>
                          <p className="text-xs text-slate-500">Creado el {formatDateTime(order.createdAt)}</p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusBadgeClass(order.status)}`}>
                            {formatOrderStatus(order.status)}
                          </span>
                          <p className="text-sm font-semibold text-slate-800">{formatCurrency(order.total ?? order.subtotal)}</p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Resumen</h4>
                          <ul className="space-y-1 text-sm text-slate-600">
                            {order.items.map(item => (
                              <li key={`${order._id}-${item.product}-${item.size}-${item.color}`}>
                                {item.quantity} x {item.title} {item.size ? `- Talla ${item.size}` : ''} {item.color ? `- ${item.color}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Linea de tiempo</h4>
                          <ul className="space-y-1 text-sm text-slate-600">
                            {order.statusHistory?.length ? (
                              order.statusHistory.map((entry, index) => (
                                <li key={`${order._id}-history-${index}`}>
                                  <span className="font-semibold text-slate-700">{formatOrderStatus(entry.status)}:</span> {formatDateTime(entry.changedAt)}
                                  {entry.note ? ` - ${entry.note}` : ''}
                                </li>
                              ))
                            ) : (
                              <li className="text-xs text-slate-500">Sin historial</li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {order.deliveredAt ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          Gracias por tu compra. Si necesitas soporte adicional, escribenos y comparte tu numero de pedido #{orderCode(order)}.
                        </div>
                      ) : order.status === 'ENVIADO' ? (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                          Tu pedido esta en camino. Pronto recibiras una notificacion de entrega.
                        </div>
                      ) : null}
                      {order.status === 'PENDIENTE_PAGO' && textMap.send_receipt_message ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                          {textMap.send_receipt_message}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;










