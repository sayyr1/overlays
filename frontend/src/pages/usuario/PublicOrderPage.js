import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiMessageCircle,
  FiPackage
} from 'react-icons/fi';
import axios from '../../api/axiosInstance';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { formatCurrency } from '../../utils/pricing';
import { ORDER_HOLD_LABEL } from '../../utils/orderConstants';
import { formatOrderStatus, getOrderStatusBadgeClass } from '../../utils/orderStatus';

const formatDateTime = value => {
  if (!value) return 'Sin fecha';
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

  const totalUnits = useMemo(
    () => (order?.items || []).reduce((acc, item) => acc + Number(item.quantity || 0), 0),
    [order]
  );

  const whatsappLink = useMemo(() => {
    if (!supportPhone || !order) return null;
    const total = order.total ?? order.subtotal;
    const message = `Hola, mi pedido es #${orderCode(order)} por ${formatCurrency(total)}.`;
    return `https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`;
  }, [order, supportPhone]);

  const nextSteps = useMemo(() => {
    if (!order) return [];

    if (order.status === 'PENDIENTE_PAGO') {
      return [
        'Realiza el deposito o transferencia usando uno de los metodos disponibles.',
        'Envia el comprobante por WhatsApp junto con tu numero de pedido.',
        `Completa la confirmacion antes de ${ORDER_HOLD_LABEL} para mantener la reserva.`
      ];
    }

    if (order.status === 'ENVIADO') {
      return [
        'Tu pedido ya salio del punto de despacho.',
        'Mantente atento al contacto registrado para coordinar la entrega.',
        'Si necesitas soporte, comparte tu numero de pedido por WhatsApp.'
      ];
    }

    if (order.status === 'ENTREGADO') {
      return [
        'El pedido ya figura como entregado.',
        'Guarda este enlace si necesitas validar la compra mas adelante.',
        'Si hubo alguna novedad postventa, contacta soporte con tu numero de pedido.'
      ];
    }

    return [
      'Tu pedido ya fue recibido correctamente.',
      'Seguiremos actualizando esta pagina cuando cambie el estado.',
      'Si tienes dudas, usa el acceso directo de soporte.'
    ];
  }, [order]);

  const summaryCards = useMemo(() => {
    if (!order) return [];

    return [
      {
        label: 'Total',
        value: formatCurrency(order.total ?? order.subtotal),
        helper: 'Monto confirmado'
      },
      {
        label: 'Unidades',
        value: totalUnits,
        helper: `${(order.items || []).length} productos`
      },
      {
        label: 'Contacto',
        value: order.contactName || 'Sin dato',
        helper: order.contactPhone || 'Telefono pendiente'
      },
      {
        label: 'Pago',
        value: activePaymentMethods.length || '0',
        helper: activePaymentMethods.length ? 'Metodos activos' : 'Sin metodos visibles'
      }
    ];
  }, [activePaymentMethods.length, order, totalUnits]);

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
      <div className="min-h-screen bg-[#141414] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-[#1a1a1a] p-10 text-center text-white/65 shadow-card-lg">
          Cargando pedido...
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#141414] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-rose-400/20 bg-[#1a1a1a] p-10 text-center shadow-card-lg">
          <h1 className="text-3xl font-semibold text-white">Pedido no disponible</h1>
          <p className="mt-3 text-sm text-white/60">
            {error || 'No encontramos informacion para este pedido.'}
          </p>
          <Link
            to="/productos"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110"
          >
            Volver al catalogo
            <FiArrowRight className="text-base" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,118,110,0.3),transparent_38%),linear-gradient(135deg,#181818_0%,#101010_100%)] p-5 shadow-card-lg sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-white/40">
                Seguimiento invitado
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                Pedido #{orderCode(order)}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                Creado el {formatDateTime(order.createdAt)}. Guarda este enlace para revisar cambios, enviar comprobantes y mantener el pedido a la mano desde el movil.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusBadgeClass(order.status)}`}>
                {formatOrderStatus(order.status)}
              </span>
              <div className="flex flex-col gap-3 sm:flex-row">
                {whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    Contactar soporte
                  </a>
                ) : null}
                <Link
                  to="/productos"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  Volver al catalogo
                </Link>
              </div>
            </div>
          </div>
        </header>

        {location.state?.justCreated ? (
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-100">
            Tu pedido fue creado correctamente. Esta es tu pagina de seguimiento para invitados.
          </div>
        ) : null}

        {order.status === 'PENDIENTE_PAGO' ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
            Completa tu pago dentro de las proximas {ORDER_HOLD_LABEL}. Luego la reserva se libera automaticamente.
            {order.expiresAt ? (
              <p className="mt-1 text-xs text-amber-200/80">
                Fecha limite: {formatDateTime(order.expiresAt)}.
              </p>
            ) : null}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(card => (
            <div
              key={card.label}
              className="rounded-[24px] border border-white/10 bg-[#1a1a1a] px-4 py-4 shadow-card-lg"
            >
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
              <p className="mt-1 text-xs text-white/50">{card.helper}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-5">
            <div className="rounded-[28px] border border-white/10 bg-[#1a1a1a] p-5 shadow-card-lg">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/40">Detalle</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Productos del pedido</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
                  {(order.items || []).length} referencias
                </span>
              </div>

              <ul className="mt-5 space-y-3">
                {(order.items || []).map(item => (
                  <li
                    key={`${order._id}-${item.product}-${item.size}-${item.color}`}
                    className="rounded-[22px] border border-white/10 bg-[#202020] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm text-white/62">
                          {item.quantity} x {formatCurrency(item.unitPrice || 0)}
                        </p>
                        <p className="mt-1 text-sm text-white/55">
                          {item.size ? `Talla ${item.size}` : 'Sin talla'}
                          {item.color ? ` - ${item.color}` : ''}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-white">
                        {formatCurrency((item.unitPrice || 0) * (item.quantity || 0))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#1a1a1a] p-5 shadow-card-lg">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-white">
                  <FiPackage className="text-lg" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/40">Seguimiento</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Linea de tiempo</h2>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {order.statusHistory?.length ? (
                  order.statusHistory.map((entry, index) => (
                    <div
                      key={`${order._id}-history-${index}`}
                      className="flex gap-3 rounded-[22px] border border-white/10 bg-[#202020] px-4 py-4"
                    >
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {formatOrderStatus(entry.status)}
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          {formatDateTime(entry.changedAt)}
                        </p>
                        {entry.note ? (
                          <p className="mt-2 text-sm text-white/68">{entry.note}</p>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-[#202020] px-4 py-5 text-sm text-white/55">
                    Aun no hay cambios adicionales registrados.
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-[28px] border border-white/10 bg-[#1a1a1a] p-5 shadow-card-lg">
              <p className="text-xs uppercase tracking-[0.28em] text-white/40">Resumen</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Datos del pedido</h2>

              <div className="mt-4 space-y-3 text-sm text-white/68">
                <p className="flex justify-between gap-4">
                  <span>Codigo</span>
                  <span className="font-semibold text-white">#{orderCode(order)}</span>
                </p>
                <p className="flex justify-between gap-4">
                  <span>Contacto</span>
                  <span className="text-right text-white">{order.contactName || 'Sin dato'}</span>
                </p>
                <p className="flex justify-between gap-4">
                  <span>Telefono</span>
                  <span className="text-right text-white">{order.contactPhone || 'S/D'}</span>
                </p>
                {order.contactEmail ? (
                  <p className="flex justify-between gap-4">
                    <span>Email</span>
                    <span className="text-right text-white">{order.contactEmail}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#1a1a1a] p-5 shadow-card-lg">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand">
                  <FiClock className="text-lg" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/40">Siguiente paso</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Que hacer ahora</h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {nextSteps.map((step, index) => (
                  <div
                    key={`${order._id}-next-step-${index}`}
                    className="flex gap-3 rounded-[22px] border border-white/10 bg-[#202020] px-4 py-4"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-white/68">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#1a1a1a] p-5 shadow-card-lg">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-white">
                  <FiCheckCircle className="text-lg" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/40">Pago</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Metodos disponibles</h2>
                </div>
              </div>

              {activePaymentMethods.length ? (
                <div className="mt-5 space-y-3 text-sm text-white/68">
                  {activePaymentMethods.map(method => (
                    <div
                      key={method._id}
                      className="rounded-[22px] border border-white/10 bg-[#202020] px-4 py-4"
                    >
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
                <p className="mt-5 rounded-[22px] border border-dashed border-white/10 bg-[#202020] px-4 py-5 text-sm text-white/55">
                  No hay metodos de pago activos en este momento.
                </p>
              )}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#17342f_0%,#101815_100%)] p-5 shadow-card-lg">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <FiMessageCircle className="text-lg" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">Soporte</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Necesitas ayuda</h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-white/72">
                Comparte tu numero de pedido para acelerar cualquier validacion, cambio de estado o confirmacion de pago.
              </p>

              <div className="mt-5 flex flex-col gap-3">
                {whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Enviar comprobante por WhatsApp
                  </a>
                ) : null}
                <Link
                  to="/productos"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
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
