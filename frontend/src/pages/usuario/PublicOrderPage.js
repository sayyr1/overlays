import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { formatCurrency } from '../../utils/pricing';
import { ORDER_HOLD_LABEL } from '../../utils/orderConstants';
import { formatOrderStatus, getOrderStatusBadgeClass } from '../../utils/orderStatus';

const formatDateTime = value => {
  if (!value) return 'S/D';
  return new Date(value).toLocaleString();
};

const orderCode = order => order?.orderNumber ?? order?._id?.slice(-6) ?? 's/n';

const PublicOrderPage = () => {
  const { lookupToken } = useParams();
  const location = useLocation();
  const { paymentMethods, settings } = usePublicConfig();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activePaymentMethods = useMemo(
    () => (paymentMethods || []).filter(method => method.enabled),
    [paymentMethods]
  );

  const supportPhone = useMemo(() => {
    const candidate = settings?.whatsapp || '';
    return String(candidate).replace(/\D/g, '');
  }, [settings?.whatsapp]);

  const whatsappLink = useMemo(() => {
    if (!supportPhone || !order) return null;
    const total = order.total ?? order.subtotal;
    const message = `Hola, mi pedido es #${orderCode(order)} por ${formatCurrency(total)}.`;
    return `https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`;
  }, [order, supportPhone]);

  useEffect(() => {
    let cancelled = false;

    const loadOrder = async () => {
      setLoading(true);
      setError('');

      try {
        const { data } = await axios.get(`/api/orders/lookup/${lookupToken}`, {
          withCredentials: true
        });

        if (!cancelled) {
          setOrder(data || null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError?.response?.data?.message || 'No pudimos encontrar ese pedido.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (lookupToken) {
      loadOrder();
    }

    return () => {
      cancelled = true;
    };
  }, [lookupToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-10">
        <div className="mx-auto max-w-5xl rounded-3xl border border-surface-200 bg-white p-10 text-center text-slate-500 shadow-brand-sm">
          Cargando pedido...
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-white p-10 text-center shadow-brand-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Pedido no disponible</h1>
          <p className="mt-3 text-sm text-slate-500">
            {error || 'No encontramos informacion para este pedido.'}
          </p>
          <Link
            to="/productos"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Volver al catalogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Seguimiento</p>
            <h1 className="text-3xl font-semibold text-slate-900">Pedido #{orderCode(order)}</h1>
            <p className="text-sm text-slate-500">Creado el {formatDateTime(order.createdAt)}.</p>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusBadgeClass(order.status)}`}>
            {formatOrderStatus(order.status)}
          </span>
        </header>

        {location.state?.justCreated ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
            Tu pedido fue creado correctamente. Esta es tu pagina de seguimiento como invitado.
          </div>
        ) : null}

        {order.status === 'PENDIENTE_PAGO' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">
            Completa tu pago dentro de las proximas {ORDER_HOLD_LABEL}. Luego la reserva se libera automaticamente.
            {order.expiresAt ? (
              <p className="mt-1 text-xs text-amber-600">
                Expira el {formatDateTime(order.expiresAt)}.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="surface-card p-5">
            <h2 className="text-lg font-semibold text-slate-900">Productos</h2>
            <ul className="mt-4 space-y-3">
              {(order.items || []).map(item => (
                <li
                  key={`${order._id}-${item.product}-${item.size}-${item.color}`}
                  className="rounded-2xl border border-surface-200 bg-surface-100 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.quantity} x {formatCurrency(item.unitPrice || 0)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.size ? `Talla ${item.size}` : 'Sin talla'}
                        {item.color ? ` - ${item.color}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency((item.unitPrice || 0) * (item.quantity || 0))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside className="space-y-4">
            <div className="surface-card p-5">
              <h2 className="text-lg font-semibold text-slate-900">Resumen</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p className="flex justify-between gap-4">
                  <span>Total</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(order.total ?? order.subtotal)}
                  </span>
                </p>
                <p className="flex justify-between gap-4">
                  <span>Contacto</span>
                  <span className="text-right">{order.contactName || 'Sin dato'}</span>
                </p>
                <p className="flex justify-between gap-4">
                  <span>Telefono</span>
                  <span className="text-right">{order.contactPhone || 'S/D'}</span>
                </p>
                {order.contactEmail ? (
                  <p className="flex justify-between gap-4">
                    <span>Email</span>
                    <span className="text-right">{order.contactEmail}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="surface-card p-5">
              <h2 className="text-lg font-semibold text-slate-900">Linea de tiempo</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {order.statusHistory?.length ? (
                  order.statusHistory.map((entry, index) => (
                    <li key={`${order._id}-history-${index}`}>
                      <span className="font-semibold text-slate-800">
                        {formatOrderStatus(entry.status)}:
                      </span>{' '}
                      {formatDateTime(entry.changedAt)}
                      {entry.note ? ` - ${entry.note}` : ''}
                    </li>
                  ))
                ) : (
                  <li>Sin historial registrado.</li>
                )}
              </ul>
            </div>

            <div className="surface-card p-5">
              <h2 className="text-lg font-semibold text-slate-900">Pago</h2>
              {activePaymentMethods.length ? (
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  {activePaymentMethods.map(method => (
                    <div key={method._id} className="rounded-2xl border border-surface-200 bg-surface-100 px-4 py-3">
                      <p className="font-semibold text-slate-900">{method.name}</p>
                      {method.instructions ? <p className="mt-1">{method.instructions}</p> : null}
                      {method.bankName ? <p className="mt-1">Banco: {method.bankName}</p> : null}
                      {method.accountNumber ? <p>Cuenta: {method.accountNumber}</p> : null}
                      {method.accountOwner ? <p>Titular: {method.accountOwner}</p> : null}
                      {method.accountId ? <p>Identificacion: {method.accountId}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No hay metodos de pago activos en este momento.
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2">
                {whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    Enviar comprobante por WhatsApp
                  </a>
                ) : null}
                <Link
                  to="/productos"
                  className="inline-flex items-center justify-center rounded-full border border-surface-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand"
                >
                  Seguir comprando
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PublicOrderPage;
