import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../../api/axiosInstance';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { usePublicConfig } from '../../context/PublicConfigContext';
import { captureContactLead, trackCheckoutStarted } from '../../services/crmTracking';
import { saveGuestOrderTracking } from '../../utils/guestOrderTracking';
import { formatCurrency } from '../../utils/pricing';
import { ORDER_HOLD_LABEL } from '../../utils/orderConstants';
import { formatOrderStatus, getOrderStatusBadgeClass } from '../../utils/orderStatus';

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
    const message = `Hola, mi pedido es #${orderLabel} por ${formatted} adjunto comprobante...`;
    return `https://wa.me/${paymentSupportNumber}?text=${encodeURIComponent(message)}`;
  }, [paymentSupportNumber, orderResult, checkoutSummary, totals]);

  const handleQuantityChange = (productId, size, color, value) => {
    const numeric = parseInt(value, 10);
    if (Number.isNaN(numeric)) return;
    updateItem({ productId, size, color, quantity: numeric });
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
      setSubmitError('Necesitamos un telefono de contacto.');
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Cargando carrito...</p>
      </div>
    );
  }

  if (!items.length && !checkoutSummary && !orderResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Tu carrito esta vacio</h2>
        <Link
          to="/productos"
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
        >
          Explorar productos
        </Link>
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
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto py-8 px-4 space-y-6">
        <h1 className="text-3xl font-semibold text-gray-800">Tu carrito</h1>

        {orderResult && !checkoutOpen && (
          <div className="rounded-3xl border border-brand/20 bg-brand/10 px-6 py-5 shadow-brand-sm text-sm text-brand">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-brand/80">Pedido generado</p>
                <h2 className="text-lg font-semibold text-brand">
                  #{orderLabel || 'SIN NUMERO'}
                </h2>
                <p className="text-xs text-brand/80">
                  Estado actual: <span className="font-semibold">{formatOrderStatus(orderResult.status)}</span>
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusBadgeClass(orderResult.status)}`}
              >
                {formatOrderStatus(orderResult.status)}
              </span>
            </div>
            <p className="mt-3 text-sm text-brand/90">
              {textMap.order_created_message || 'Tu pedido fue creado correctamente.'}
            </p>
            <p className="mt-1 text-sm text-brand/90">
              {`Hemos reservado tu stock durante ${ORDER_HOLD_LABEL}. Sigue el estado de tu pedido desde su pagina de seguimiento.`}
            </p>
            {expirationLabel && (
              <p className="mt-1 text-xs text-brand/80">
                Recuerda que expira el {expirationLabel}.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                to={orderDestination.to}
                state={orderDestination.state}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand-sm transition hover:bg-brand-dark"
              >
                {orderActionLabel}
              </Link>
              <button
                type="button"
                onClick={resetOrderFeedback}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-brand/30 px-4 py-2 text-sm font-semibold text-brand transition hover:border-brand hover:bg-white"
              >
                Ocultar mensaje
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {items.map(item => (
              <div
                key={`${item.productId}-${item.size}-${item.color || 'default'}`}
                className="bg-white rounded-lg shadow p-4 flex gap-4"
              >
                <img
                  src={item.imageUrl || ''}
                  alt={item.title}
                  className="w-24 h-24 object-cover rounded-md border border-gray-200"
                />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">{item.title}</h3>
                  <p className="text-sm text-gray-500">
                    Precio unitario: {formatCurrency(item.unitPrice)}
                  </p>
                  {item.size && (
                    <p className="text-sm text-gray-500">Talla: {item.size}</p>
                  )}
                  {item.color && (
                    <p className="text-sm text-gray-500">Color: {item.color}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <label
                      className="text-sm text-gray-600"
                      htmlFor={`qty-${item.productId}-${item.size}-${item.color}`}
                    >
                      Cantidad
                    </label>
                    <input
                      id={`qty-${item.productId}-${item.size}-${item.color}`}
                      type="number"
                      min={1}
                      max={99}
                      value={item.quantity}
                      onChange={e =>
                        handleQuantityChange(item.productId, item.size, item.color, e.target.value)
                      }
                      className="w-20 border border-gray-300 rounded-md p-2 text-center"
                    />
                    <button
                      onClick={() => handleRemove(item.productId, item.size, item.color)}
                      className="text-sm text-red-600 hover:text-red-700"
                      type="button"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="bg-white rounded-lg shadow p-6 h-fit">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Resumen</h2>
            <p className="flex justify-between text-gray-700 mb-2">
              <span>Articulos</span>
              <span>{totals.items}</span>
            </p>
            <p className="flex justify-between text-gray-700 mb-4">
              <span>Cantidad total</span>
              <span>{totals.count}</span>
            </p>
            <p className="flex justify-between text-lg font-semibold text-gray-800 mb-6">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </p>

            {!isAuthenticated && (
              <p className="text-sm text-gray-500 mb-4">
                Puedes comprar sin iniciar sesión. Inicia sesión solo si deseas guardar tu carrito.
              </p>
            )}

            <button
              onClick={clearCart}
              className="w-full mb-3 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition duration-200"
              type="button"
            >
              Vaciar carrito
            </button>
            <button
              onClick={openCheckout}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-200"
              type="button"
            >
              {textMap.checkout_title || 'Generar pedido'}
            </button>
          </aside>
        </div>
      </div>

      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6">
            {orderResult ? (
              <div>
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">Pedido generado</h3>
                <p className="text-gray-700 mb-2">
                  Tu numero de pedido es{' '}
                  <span className="font-semibold">#{orderLabel || 'SIN NUMERO'}</span>.
                </p>
                <p className="text-gray-700 mb-2">
                  Total a depositar:{' '}
                  <span className="font-semibold">{formatCurrency(orderResult.total)}</span>
                </p>
                {expirationLabel && (
                  <p className="text-sm text-gray-500 mb-4">
                    Tu pedido expira el {expirationLabel}. Pasadas {ORDER_HOLD_LABEL} se liberara la reserva automaticamente.
                  </p>
                )}
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Métodos de pago activos</h4>
                <div className="space-y-3 text-sm text-gray-700 mb-4">
                  {activePaymentMethods.length ? (
                    activePaymentMethods.map(method => (
                      <div key={method._id} className="rounded-xl border border-gray-200 px-4 py-3">
                        <p className="font-semibold text-gray-800">{method.name}</p>
                        <p className="text-xs uppercase tracking-wide text-gray-400">{method.type}</p>
                        {method.instructions && <p className="mt-2">{method.instructions}</p>}
                        {method.bankName && <p><strong>Banco:</strong> {method.bankName}</p>}
                        {method.accountNumber && <p><strong>Número de cuenta:</strong> {method.accountNumber}</p>}
                        {method.accountOwner && <p><strong>Titular:</strong> {method.accountOwner}</p>}
                        {method.accountId && <p><strong>Identificación:</strong> {method.accountId}</p>}
                        {method.accountType && <p><strong>Tipo de cuenta:</strong> {method.accountType}</p>}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
                      No hay métodos de pago configurados. Contáctanos antes de completar el pago.
                    </div>
                  )}
                </div>
                {checkoutSummary?.items?.length ? (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Detalle del pedido</h4>
                    <ul className="max-h-40 overflow-y-auto space-y-1 text-sm text-gray-600 pr-1">
                      {checkoutSummary.items.map(item => (
                        <li key={`${item.productId}-${item.size}-${item.color || 'default'}`}>
                          {item.quantity} x {item.title}{' '}
                          {item.size ? `- Talla ${item.size}` : ''}{' '}
                          {item.color ? `- Color ${item.color}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="mt-4 text-sm text-gray-600">
                  {(textMap.send_receipt_message || 'Envía tu comprobante indicando tu número de pedido.')}
                  {' '}
                  {paymentSupportNumber ? (
                    <>
                      Número de contacto: <strong>{paymentSupportNumber}</strong>.
                    </>
                  ) : null}
                  {' '}Pedido #{orderLabel || 'sin numero'}.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 transition"
                    >
                      Enviar por WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => closeCheckout(true)}
                    className="flex-1 rounded-md bg-brand px-4 py-2 text-white font-medium hover:bg-brand-dark transition"
                    type="button"
                  >
                    {hasPublicTracking ? 'Seguir pedido' : isAuthenticated ? 'Ver mis pedidos' : 'Volver al catalogo'}
                  </button>
                  <button
                    onClick={() => closeCheckout(false)}
                    className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                    type="button"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <h3 className="text-2xl font-semibold text-gray-800">
                  {textMap.checkout_title || 'Datos de contacto'}
                </h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>
                    {textMap.payment_instructions ||
                      'Completa el pago usando uno de los metodos activos y comparte el comprobante.'}
                  </p>
                  <p>
                    {`Guardaremos tu pedido como pendiente durante ${ORDER_HOLD_LABEL}. Completa los datos para poder contactarte y reservar el stock.`}
                  </p>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm text-gray-700">
                    Nombre y apellido
                    <input
                      type="text"
                      name="name"
                      value={contact.name}
                      onChange={handleContactChange}
                      onBlur={handleContactBlur}
                      className="mt-1 w-full rounded-md border border-gray-300 p-2"
                      required
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    Telefono (WhatsApp)
                    <input
                      type="tel"
                      name="phone"
                      value={contact.phone}
                      onChange={handleContactChange}
                      onBlur={handleContactBlur}
                      className="mt-1 w-full rounded-md border border-gray-300 p-2"
                      required
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    Correo electronico (opcional)
                    <input
                      type="email"
                      name="email"
                      value={contact.email}
                      onChange={handleContactChange}
                      onBlur={handleContactBlur}
                      className="mt-1 w-full rounded-md border border-gray-300 p-2"
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    Direccion de entrega o referencia (opcional)
                    <textarea
                      name="address"
                      value={contact.address}
                      onChange={handleContactChange}
                      className="mt-1 w-full rounded-md border border-gray-300 p-2"
                      rows={2}
                    />
                  </label>
                </div>
                {submitError && (
                  <p className="text-sm text-red-600">{submitError}</p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => closeCheckout(false)}
                    className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-md bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 transition disabled:opacity-60"
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
