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
  if (!value) return 'Sin fecha';
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

  const stats = useMemo(() => {
    const totalSpent = orders.reduce((acc, order) => acc + Number(order.total ?? order.subtotal ?? 0), 0);
    const deliveredCount = orders.filter(order => order.status === 'ENTREGADO').length;

    return {
      total: orders.length,
      pending: pendingOrders.length,
      delivered: deliveredCount,
      totalSpent
    };
  }, [orders, pendingOrders.length]);

  const getWhatsappLink = order => {
    if (!sanitizedPhone) return null;
    const total = order.total ?? order.subtotal;
    const message = `Hola, mi pedido es #${orderCode(order)} por ${formatCurrency(total)}.`;
    return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;
  };

  const isHighlighted = order =>
    highlightOrderId &&
    (order._id === highlightOrderId ||
      (hasNumericHighlight && order.orderNumber === highlightOrderNumber));

  const renderOrderItems = order => (
    <ul className="space-y-2 text-sm text-white/68">
      {order.items.map(item => (
        <li key={`${order._id}-${item.product}-${item.size}-${item.color}`}>
          {item.quantity} x {item.title}
          {item.size ? ` - Talla ${item.size}` : ''}
          {item.color ? ` - ${item.color}` : ''}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,118,110,0.28),transparent_40%),linear-gradient(135deg,#181818_0%,#101010_100%)] p-5 shadow-card-lg sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-white/40">
                Post compra
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                Mis pedidos
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                Revisa reservas, confirma pagos y sigue cada pedido desde una vista mas clara y ordenada.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={fetchOrders}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Actualizar pedidos
              </button>
              <Link
                to="/productos"
                className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Seguir comprando
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-white/10 bg-[#1a1a1a] px-4 py-4 shadow-card-lg">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Pedidos</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.total}</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#1a1a1a] px-4 py-4 shadow-card-lg">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Pendientes</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.pending}</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#1a1a1a] px-4 py-4 shadow-card-lg">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Entregados</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.delivered}</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#1a1a1a] px-4 py-4 shadow-card-lg">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Total invertido</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(stats.totalSpent)}</p>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-[28px] border border-white/10 bg-[#1a1a1a] p-10 text-center text-white/65 shadow-card-lg">
            Cargando pedidos...
          </div>
        ) : !orders.length ? (
          <div className="rounded-[28px] border border-white/10 bg-[#1a1a1a] p-10 text-center shadow-card-lg">
            <h2 className="text-xl font-semibold text-white">Aun no registras pedidos</h2>
            <p className="mt-2 text-sm text-white/60">Explora el catalogo y crea tu primera reserva.</p>
            <Link
              to="/productos"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110"
            >
              Ver productos
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {pendingOrders.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Pendientes de pago</h2>
                    <p className="mt-1 text-sm text-white/55">
                      Confirma tu deposito dentro de {ORDER_HOLD_LABEL} para mantener activa la reserva.
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                    {pendingOrders.length} activos
                  </span>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {pendingOrders.map(order => {
                    const whatsappLink = getWhatsappLink(order);
                    const highlight = isHighlighted(order);
                    return (
                      <article
                        key={order._id}
                        className={`rounded-[28px] border bg-[#1a1a1a] p-5 shadow-card-lg ${
                          highlight ? 'border-brand/50 ring-2 ring-brand/30' : 'border-white/10'
                        }`}
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Pedido</p>
                              <h3 className="mt-2 text-2xl font-semibold text-white">#{orderCode(order)}</h3>
                              <p className="mt-1 text-xs text-white/50">
                                Creado el {formatDateTime(order.createdAt)}
                              </p>
                            </div>
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusBadgeClass(order.status)}`}>
                              {formatOrderStatus(order.status)}
                            </span>
                          </div>

                          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                            Completa tu pago dentro de las proximas {ORDER_HOLD_LABEL}.
                            {order.expiresAt && (
                              <p className="mt-1 text-xs text-amber-200/80">
                                Expira el {formatDateTime(order.expiresAt)}.
                              </p>
                            )}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Total</p>
                              <p className="mt-2 text-lg font-semibold text-white">
                                {formatCurrency(order.total ?? order.subtotal)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Contacto</p>
                              <p className="mt-2 text-sm font-semibold text-white">{order.contactName || 'Sin dato'}</p>
                              <p className="mt-1 text-xs text-white/55">{order.contactPhone || 'S/D'}</p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-[#202020] p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Productos</p>
                            <div className="mt-3">{renderOrderItems(order)}</div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-[#202020] p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Pago</p>
                            {activePaymentMethods.length ? (
                              <div className="mt-3 space-y-3 text-sm text-white/68">
                                {activePaymentMethods.map(method => (
                                  <div key={method._id} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                                    <p className="font-semibold text-white">{method.name}</p>
                                    {method.instructions ? <p className="mt-2">{method.instructions}</p> : null}
                                    {method.bankName ? <p className="mt-2">Banco: {method.bankName}</p> : null}
                                    {method.accountNumber ? <p>Cuenta: {method.accountNumber}</p> : null}
                                    {method.accountOwner ? <p>Titular: {method.accountOwner}</p> : null}
                                    {method.accountId ? <p>Identificacion: {method.accountId}</p> : null}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-3 text-sm text-white/55">
                                No hay metodos de pago configurados actualmente.
                              </p>
                            )}
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-[#202020] p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Estado</p>
                            <ul className="mt-3 space-y-2 text-sm text-white/65">
                              {order.statusHistory?.length ? (
                                order.statusHistory.map((entry, index) => (
                                  <li key={`${order._id}-pending-history-${index}`}>
                                    <span className="font-semibold text-white">{formatOrderStatus(entry.status)}:</span>{' '}
                                    {formatDateTime(entry.changedAt)}
                                    {entry.note ? ` - ${entry.note}` : ''}
                                  </li>
                                ))
                              ) : (
                                <li>Sin historial registrado.</li>
                              )}
                            </ul>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row">
                            {whatsappLink && (
                              <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex flex-1 items-center justify-center rounded-full bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                              >
                                Confirmar por WhatsApp
                              </a>
                            )}
                            <Link
                              to="/productos"
                              className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                            >
                              Seguir comprando
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {recentOrders.length > 0 && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Historial</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Tus pedidos ya procesados, enviados o entregados en una sola linea de tiempo.
                  </p>
                </div>

                <div className="space-y-4">
                  {recentOrders.map(order => (
                    <article
                      key={order._id}
                      className={`rounded-[28px] border bg-[#1a1a1a] p-5 shadow-card-lg ${
                        isHighlighted(order) ? 'border-brand/50 ring-2 ring-brand/30' : 'border-white/10'
                      }`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Pedido</p>
                            <h3 className="mt-2 text-2xl font-semibold text-white">#{orderCode(order)}</h3>
                            <p className="mt-1 text-xs text-white/50">Creado el {formatDateTime(order.createdAt)}</p>
                          </div>
                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusBadgeClass(order.status)}`}>
                              {formatOrderStatus(order.status)}
                            </span>
                            <p className="text-lg font-semibold text-white">{formatCurrency(order.total ?? order.subtotal)}</p>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                          <div className="rounded-2xl border border-white/10 bg-[#202020] p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Resumen</p>
                            <div className="mt-3">{renderOrderItems(order)}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-[#202020] p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Linea de tiempo</p>
                            <ul className="mt-3 space-y-2 text-sm text-white/65">
                              {order.statusHistory?.length ? (
                                order.statusHistory.map((entry, index) => (
                                  <li key={`${order._id}-history-${index}`}>
                                    <span className="font-semibold text-white">{formatOrderStatus(entry.status)}:</span>{' '}
                                    {formatDateTime(entry.changedAt)}
                                    {entry.note ? ` - ${entry.note}` : ''}
                                  </li>
                                ))
                              ) : (
                                <li>Sin historial registrado.</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        {order.deliveredAt ? (
                          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                            Gracias por tu compra. Si necesitas soporte adicional, comparte tu numero de pedido #{orderCode(order)}.
                          </div>
                        ) : order.status === 'ENVIADO' ? (
                          <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
                            Tu pedido esta en camino. Pronto recibiras confirmacion de entrega.
                          </div>
                        ) : null}

                        {order.status === 'PENDIENTE_PAGO' && textMap.send_receipt_message ? (
                          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                            {textMap.send_receipt_message}
                          </div>
                        ) : null}
                      </div>
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
