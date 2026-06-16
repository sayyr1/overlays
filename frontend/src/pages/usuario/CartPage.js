import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiMinus, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import axios from '../../api/axiosInstance';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { captureContactLead, trackCheckoutStarted } from '../../services/crmTracking';
import { saveGuestOrderTracking } from '../../utils/guestOrderTracking';
import { formatCurrency } from '../../utils/pricing';
import { ORDER_HOLD_LABEL } from '../../utils/orderConstants';
import { formatOrderStatus, getOrderStatusBadgeClass } from '../../utils/orderStatus';

const inputClassName =
  'mt-1 w-full rounded-2xl border border-white/10 bg-[#232323] px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

const getOrderLabel = order => {
  if (!order) return '';
  if (order.orderId) return order.orderId;
  if (order.id) return order.id.toString().slice(-6).toUpperCase();
  return '';
};

const buildOrderDestination = (order, isAuthenticated) => {
  if (order?.lookupToken) {
    return {
      to: `/pedido/${order.lookupToken}`,
      state: undefined
    };
  }

  if (isAuthenticated) {
    return {
      to: '/mis-pedidos',
      state: { highlightOrder: order?.id || order?.orderId }
    };
  }

  return {
    to: '/productos',
    state: undefined
  };
};

const CartPage = () => {
  const { items, totals, updateItem, removeItem, clearCart, loading } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { paymentMethods, textMap, settings, isModuleEnabled } = usePublicConfig();
  const navigate = useNavigate();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [checkoutSummary, setCheckoutSummary] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contact, setContact] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  const resetOrderFeedback = () => {
    setOrderResult(null);
    setCheckoutSummary(null);
  };

  useEffect(() => {
    if (!user) return;
    setContact(prev => ({
      name: prev.name || user.name || '',
      phone: prev.phone || user.phone || '',
      email: prev.email || user.email || '',
      address: prev.address || user.address || ''
    }));
  }, [user]);

  const activePaymentMethods = useMemo(
    () => (paymentMethods || []).filter(method => method.enabled),
    [paymentMethods]
  );

  const paymentSupportNumber = useMemo(() => {
    const candidate = settings?.whatsapp || '';
    return String(candidate).replace(/\D/g, '');
  }, [settings?.whatsapp]);

  const whatsappLink = useMemo(() => {
    if (!paymentSupportNumber) return null;
    const orderLabel = getOrderLabel(orderResult);
    if (!orderLabel) {
      return `https://wa.me/${paymentSupportNumber}`;
    }

    const totalForMessage =
      orderResult?.total ?? checkoutSummary?.totals?.subtotal ?? totals.subtotal;
    const formatted = formatCurrency(totalForMessage || 0);
    const message = `Hola, mi pedido es #${orderLabel} por ${formatted} adjunto comprobante.`;
    return `https://wa.me/${paymentSupportNumber}?text=${encodeURIComponent(message)}`;
  }, [paymentSupportNumber, orderResult, checkoutSummary, totals]);

  const handleQuantityChange = (productId, size, color, value) => {
    const numeric = parseInt(value, 10);
    if (Number.isNaN(numeric)) return;
    updateItem({ productId, size, color, quantity: numeric });
  };

  const handleStepQuantity = (item, delta) => {
    const nextQuantity = Math.max(1, Math.min(99, Number(item.quantity || 1) + delta));
    updateItem({
      productId: item.productId,
      size: item.size,
      color: item.color,
      quantity: nextQuantity
    });
  };

  const handleRemove = (productId, size, color) => {
    removeItem({ productId, size, color });
  };

  const openCheckout = () => {
    resetOrderFeedback();
    setCheckoutOpen(true);
    setSubmitError('');

    if (isModuleEnabled('crm')) {
      trackCheckoutStarted({ items });
    }
  };

  const closeCheckout = (redirectToOrders = false) => {
    setCheckoutOpen(false);
    setIsSubmitting(false);
    setSubmitError('');
    if (redirectToOrders && orderResult) {
      const destination = buildOrderDestination(orderResult, isAuthenticated);
      navigate(destination.to, destination.state ? { state: destination.state } : undefined);
    }
  };

  const handleContactChange = event => {
    const { name, value } = event.target;
    setContact(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckoutSubmit = async event => {
    event.preventDefault();
    if (!items.length) {
      setSubmitError('Tu carrito esta vacio.');
      return;
    }

    const name = contact.name.trim();
    const phone = contact.phone.trim();
    if (!name) {
      setSubmitError('Ingresa tu nombre para identificar el pedido.');
      return;
    }
    if (!phone) {
      setSubmitError('Necesitamos un celular de contacto.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    const payload = {
      items: items.map(item => ({
        productId: item.productId,
        size: item.size,
        color: item.color,
        quantity: item.quantity
      })),
      contactName: name,
      contactPhone: phone,
      contactEmail: contact.email.trim(),
      contactAddress: contact.address.trim(),
      notes: '',
      totals
    };

    try {
      if (isModuleEnabled('crm')) {
        await captureContactLead({
          name,
          phone,
          email: contact.email.trim()
        });
        await trackCheckoutStarted({
          items,
          contactName: name,
          contactPhone: phone,
          contactEmail: contact.email.trim()
        });
      }

      const summary = {
        totals: { ...totals },
        items: items.map(item => ({ ...item }))
      };
      const { data } = await axios.post('/api/orders', payload, { withCredentials: true });
      const shouldRedirectToGuestOrder = !isAuthenticated && data?.lookupToken;

      if (shouldRedirectToGuestOrder) {
        saveGuestOrderTracking({
          lookupToken: data.lookupToken,
          orderId: data.orderId || data.id || ''
        });
      }

      setCheckoutSummary(summary);
      setOrderResult(data);
      await clearCart();
      setSubmitError('');

      if (shouldRedirectToGuestOrder) {
        setCheckoutOpen(false);
        navigate(`/pedido/${data.lookupToken}`, {
          state: {
            justCreated: true,
            orderId: data.orderId || data.id || ''
          }
        });
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || 'No se pudo crear el pedido. Intenta nuevamente.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContactBlur = () => {
    if (!isModuleEnabled('crm')) {
      return;
    }

    if (!contact.phone.trim() && !contact.email.trim()) {
      return;
    }

    captureContactLead({
      name: contact.name.trim(),
      phone: contact.phone.trim(),
      email: contact.email.trim()
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-[#1a1a1a] px-6 py-14 text-center text-white/70 shadow-card-lg">
          Cargando carrito...
        </div>
      </div>
    );
  }

  if (!items.length && !checkoutSummary && !orderResult) {
    return (
      <div className="min-h-screen bg-[#141414] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-[32px] border border-white/10 bg-[#1a1a1a] px-6 py-14 text-center shadow-card-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/40">
            Carrito
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Tu carrito esta vacio</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-white/65">
            Explora el catalogo, encuentra tus favoritos y vuelve aqui para cerrar la compra con una reserva clara y seguimiento del pedido.
          </p>
          <Link
            to="/productos"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
          >
            Explorar productos
            <FiArrowRight className="text-base" />
          </Link>
        </div>
      </div>
    );
  }

  const expirationLabel = orderResult?.expiresAt
    ? new Date(orderResult.expiresAt).toLocaleString()
    : null;

  const orderLabel = getOrderLabel(orderResult);
  const orderDestination = buildOrderDestination(orderResult, isAuthenticated);
  const hasPublicTracking = Boolean(orderResult?.lookupToken);
  const orderActionLabel = hasPublicTracking
    ? 'Seguir pedido'
    : isAuthenticated
      ? 'Ver pedido'
      : 'Volver al catalogo';

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,118,110,0.32),transparent_38%),linear-gradient(135deg,#181818_0%,#101010_100%)] p-5 shadow-card-lg sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-white/45">
                Checkout
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Tu carrito de compra
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                Revisa productos, ajusta cantidades y genera tu pedido con reserva de stock durante {ORDER_HOLD_LABEL}.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Articulos</p>
                <p className="mt-2 text-2xl font-semibold text-white">{totals.items}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Unidades</p>
                <p className="mt-2 text-2xl font-semibold text-white">{totals.count}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Subtotal</p>
                <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(totals.subtotal)}</p>
              </div>
            </div>
          </div>
        </header>

        {orderResult && !checkoutOpen && (
          <div className="rounded-[28px] border border-brand/30 bg-brand/10 px-6 py-5 text-sm text-white shadow-brand-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/55">Pedido generado</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">#{orderLabel || 'SIN NUMERO'}</h2>
                <p className="mt-1 text-sm text-white/70">
                  Estado actual: <span className="font-semibold text-white">{formatOrderStatus(orderResult.status)}</span>
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusBadgeClass(orderResult.status)}`}
              >
                {formatOrderStatus(orderResult.status)}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/80">
              {textMap.order_created_message || 'Tu pedido fue creado correctamente.'}
            </p>
            <p className="mt-1 text-sm leading-6 text-white/70">
              El stock queda reservado durante {ORDER_HOLD_LABEL}. Usa la pagina de seguimiento para revisar el estado y completar el pago.
            </p>
            {expirationLabel && (
              <p className="mt-1 text-xs text-white/55">
                La reserva expira el {expirationLabel}.
              </p>
            )}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                to={orderDestination.to}
                state={orderDestination.state}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                {orderActionLabel}
                <FiArrowRight className="text-base" />
              </Link>
              <button
                type="button"
                onClick={resetOrderFeedback}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ocultar mensaje
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-4">
            {items.map(item => (
              <article
                key={`${item.productId}-${item.size}-${item.color || 'default'}`}
                className="rounded-[26px] border border-white/10 bg-[#1a1a1a] p-4 shadow-card-lg sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="h-28 w-full overflow-hidden rounded-[20px] border border-white/10 bg-[#232323] sm:h-28 sm:w-28 sm:flex-none">
                    <img
                      src={item.imageUrl || ''}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/55">
                          {item.size ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                              Talla {item.size}
                            </span>
                          ) : null}
                          {item.color ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                              {item.color}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-xs uppercase tracking-[0.22em] text-white/40">Precio unitario</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-white/40">Cantidad</p>
                        <div className="mt-2 inline-flex items-center rounded-full border border-white/10 bg-[#232323] px-2 py-2">
                          <button
                            type="button"
                            onClick={() => handleStepQuantity(item, -1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
                            aria-label="Disminuir cantidad"
                          >
                            <FiMinus />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={item.quantity}
                            onChange={e =>
                              handleQuantityChange(item.productId, item.size, item.color, e.target.value)
                            }
                            className="w-14 bg-transparent text-center text-sm font-semibold text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleStepQuantity(item, 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
                            aria-label="Aumentar cantidad"
                          >
                            <FiPlus />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="text-left sm:text-right">
                          <p className="text-xs uppercase tracking-[0.22em] text-white/40">Subtotal</p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {formatCurrency(Number(item.unitPrice || 0) * Number(item.quantity || 0))}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.productId, item.size, item.color)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20 hover:text-white"
                          aria-label="Eliminar producto"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[26px] border border-white/10 bg-[#1a1a1a] p-5 shadow-card-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">Resumen</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Cierre de compra</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                  {activePaymentMethods.length} metodos
                </span>
              </div>

              <div className="mt-5 space-y-3 text-sm text-white/70">
                <p className="flex justify-between gap-4">
                  <span>Articulos</span>
                  <span className="font-semibold text-white">{totals.items}</span>
                </p>
                <p className="flex justify-between gap-4">
                  <span>Unidades</span>
                  <span className="font-semibold text-white">{totals.count}</span>
                </p>
                <div className="border-t border-white/10 pt-3">
                  <p className="flex justify-between gap-4 text-base">
                    <span className="font-semibold text-white">Subtotal</span>
                    <span className="font-semibold text-white">{formatCurrency(totals.subtotal)}</span>
                  </p>
                </div>
              </div>

              {!isAuthenticated && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white/65">
                  Puedes comprar sin iniciar sesion. Solo te pediremos tus datos de contacto al generar el pedido.
                </div>
              )}

              <div className="mt-5 grid gap-3">
                <button
                  onClick={openCheckout}
                  className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                  type="button"
                >
                  {textMap.checkout_title || 'Generar pedido'}
                </button>
                <button
                  onClick={clearCart}
                  className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                  type="button"
                >
                  Vaciar carrito
                </button>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-[#1a1a1a] p-5 shadow-card-lg">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Confianza</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-white/65">
                <p>Reservamos tu stock durante {ORDER_HOLD_LABEL} una vez generado el pedido.</p>
                <p>Recibiras una pagina de seguimiento para validar estado, pago y confirmacion.</p>
                {paymentSupportNumber ? (
                  <p>Soporte por WhatsApp: <span className="font-semibold text-white">{paymentSupportNumber}</span></p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#181818] p-6 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-white/40">
                  Checkout
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  {orderResult ? 'Pedido generado' : textMap.checkout_title || 'Datos de contacto'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => closeCheckout(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar checkout"
              >
                <FiX />
              </button>
            </div>

            {orderResult ? (
              <div>
                <div className="rounded-[24px] border border-brand/25 bg-brand/10 px-5 py-4 text-sm text-white/75">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-white/45">Pedido</p>
                      <p className="mt-2 text-2xl font-semibold text-white">#{orderLabel || 'SIN NUMERO'}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusBadgeClass(orderResult.status)}`}
                    >
                      {formatOrderStatus(orderResult.status)}
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-white/75">
                    Total a depositar: <span className="font-semibold text-white">{formatCurrency(orderResult.total)}</span>
                  </p>
                  {expirationLabel && (
                    <p className="mt-1 text-xs text-white/50">
                      Expira el {expirationLabel}. Pasado ese plazo se libera la reserva automaticamente.
                    </p>
                  )}
                </div>

                <div className="mt-5 rounded-[24px] border border-white/10 bg-[#202020] p-5">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
                    Metodos de pago activos
                  </h4>
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    {activePaymentMethods.length ? (
                      activePaymentMethods.map(method => (
                        <div key={method._id} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                          <p className="font-semibold text-white">{method.name}</p>
                          {method.instructions ? <p className="mt-2">{method.instructions}</p> : null}
                          {method.bankName ? <p className="mt-2">Banco: {method.bankName}</p> : null}
                          {method.accountNumber ? <p>Cuenta: {method.accountNumber}</p> : null}
                          {method.accountOwner ? <p>Titular: {method.accountOwner}</p> : null}
                          {method.accountId ? <p>Identificacion: {method.accountId}</p> : null}
                          {method.accountType ? <p>Tipo de cuenta: {method.accountType}</p> : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-amber-200">
                        No hay metodos de pago configurados. Contactanos antes de completar el pago.
                      </div>
                    )}
                  </div>
                </div>

                {checkoutSummary?.items?.length ? (
                  <div className="mt-5 rounded-[24px] border border-white/10 bg-[#202020] p-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
                      Detalle del pedido
                    </h4>
                    <ul className="mt-4 max-h-44 space-y-2 overflow-y-auto pr-1 text-sm text-white/70">
                      {checkoutSummary.items.map(item => (
                        <li key={`${item.productId}-${item.size}-${item.color || 'default'}`}>
                          {item.quantity} x {item.title}
                          {item.size ? ` - Talla ${item.size}` : ''}
                          {item.color ? ` - Color ${item.color}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="mt-5 text-sm leading-6 text-white/65">
                  {textMap.send_receipt_message || 'Envia tu comprobante indicando tu numero de pedido.'}
                  {paymentSupportNumber ? (
                    <>
                      {' '}Contacto: <span className="font-semibold text-white">{paymentSupportNumber}</span>.
                    </>
                  ) : null}
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                    >
                      Enviar por WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => closeCheckout(true)}
                    className="flex-1 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                    type="button"
                  >
                    {hasPublicTracking ? 'Seguir pedido' : isAuthenticated ? 'Ver mis pedidos' : 'Volver al catalogo'}
                  </button>
                  <button
                    onClick={() => closeCheckout(false)}
                    className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                    type="button"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckoutSubmit} className="space-y-5">
                <div className="rounded-[24px] border border-white/10 bg-[#202020] px-5 py-4 text-sm leading-6 text-white/65">
                  <p>
                    {textMap.payment_instructions ||
                      'Completa el pago usando uno de los metodos activos y comparte el comprobante cuando termines.'}
                  </p>
                  <p className="mt-2">
                    Guardaremos tu pedido como pendiente durante {ORDER_HOLD_LABEL}. Completa los datos para poder contactarte y reservar el stock.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-white">Nombre y apellido</span>
                    <input
                      type="text"
                      name="name"
                      value={contact.name}
                      onChange={handleContactChange}
                      onBlur={handleContactBlur}
                      className={inputClassName}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">Telefono</span>
                    <input
                      type="tel"
                      name="phone"
                      value={contact.phone}
                      onChange={handleContactChange}
                      onBlur={handleContactBlur}
                      className={inputClassName}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">Correo opcional</span>
                    <input
                      type="email"
                      name="email"
                      value={contact.email}
                      onChange={handleContactChange}
                      onBlur={handleContactBlur}
                      className={inputClassName}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-white">Direccion o referencia</span>
                    <textarea
                      name="address"
                      value={contact.address}
                      onChange={handleContactChange}
                      className={inputClassName}
                      rows={3}
                    />
                  </label>
                </div>

                {submitError && (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                    {submitError}
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => closeCheckout(false)}
                    className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Generando...' : textMap.checkout_title || 'Generar pedido'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
