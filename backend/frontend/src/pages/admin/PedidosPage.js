import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../api/axiosInstance';
import { formatCurrency } from '../../utils/pricing';
import {
  formatOrderStatus,
  getOrderStatusBadgeClass,
  ORDER_STATUS_FLOW
} from '../../utils/orderStatus';

const formatDateTime = value => {
  if (!value) return 'S/D';
  return new Date(value).toLocaleString();
};

const getOrderLabel = order => order.orderNumber ?? order._id?.slice(-6) ?? 's/n';

const resolveProductInfo = item => {
  if (!item) return {};
  if (item.productDetails && typeof item.productDetails === 'object') {
    return item.productDetails;
  }
  if (item.product && typeof item.product === 'object') {
    return item.product;
  }
  return {};
};

const PedidosPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get('/api/orders', { withCredentials: true });
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('No se pudieron cargar los pedidos.');
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

  const otherOrders = useMemo(
    () => orders.filter(order => order.status !== 'PENDIENTE_PAGO'),
    [orders]
  );

  const toggleExpanded = id => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleConfirm = async order => {
    const note = window.prompt('Nota para el pago (opcional):', '') ?? '';
    const paymentReference = window.prompt('Referencia de pago (opcional):', '') ?? '';
    setUpdatingId(order._id);
    try {
      await axios.post(
        `/api/orders/${order._id}/confirm`,
        { note, paymentReference },
        { withCredentials: true }
      );
      await fetchOrders();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'No se pudo confirmar el pedido.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancel = async order => {
    const shouldCancel = window.confirm(`Cancelar el pedido #${getOrderLabel(order)}?`);
    if (!shouldCancel) return;
    const note = window.prompt('Motivo de cancelacion (opcional):', '') ?? '';
    setUpdatingId(order._id);
    try {
      await axios.post(
        `/api/orders/${order._id}/cancel`,
        { note },
        { withCredentials: true }
      );
      await fetchOrders();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'No se pudo cancelar el pedido.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusUpdate = async order => {
    const options = ORDER_STATUS_FLOW[order.status];
    if (!options?.length) {
      window.alert('Este pedido no admite cambios adicionales de estado.');
      return;
    }

    const selected = window
      .prompt(
        `Selecciona uno de los estados disponibles: ${options.join(', ')}`,
        options[0]
      )
      ?.trim()
      .toUpperCase();

    if (!selected) {
      return;
    }

    if (!options.includes(selected)) {
      window.alert('Estado no valido. Usa una de las opciones sugeridas.');
      return;
    }

    const note = window.prompt('Nota interna (opcional):', '') ?? '';
    setUpdatingId(order._id);
    try {
      await axios.patch(
        `/api/orders/${order._id}/status`,
        { status: selected, note },
        { withCredentials: true }
      );
      await fetchOrders();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'No se pudo actualizar el estado.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-gray-800">Pedidos</h2>
          <p className="text-sm text-gray-500">
            Gestiona los pedidos pendientes, confirma pagos y consulta el historial reciente.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOrders}
          className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100 transition"
        >
          Recargar
        </button>
      </div>

      {loading && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          Cargando pedidos...
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && pendingOrders.length === 0 && otherOrders.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          No hay pedidos registrados.
        </div>
      )}

      {pendingOrders.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-800">Pedidos pendientes</h3>
            <p className="text-sm text-gray-500">
              Confirma o cancela pagos y revisa los detalles de cada pedido.
            </p>
          </div>
          <div className="overflow-x-auto px-6 py-4">
            <table className="min-w-full text-sm text-gray-700">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Pedido</th>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-left">Total</th>
                  <th className="px-4 py-2 text-left">Caduca</th>
                  <th className="px-4 py-2 text-left">Acciones</th>
                  <th className="px-4 py-2 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pendingOrders.map(order => (
                  <React.Fragment key={order._id}>
                    <tr>
                      <td className="px-4 py-3 font-semibold">#{getOrderLabel(order)}</td>
                      <td className="px-4 py-3">{order.contactName || order.user?.name || 'Sin nombre'}</td>
                      <td className="px-4 py-3">{formatCurrency(order.total ?? order.subtotal)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(order.expiresAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleConfirm(order)}
                            disabled={updatingId === order._id}
                            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-green-700 transition disabled:opacity-50"
                          >
                            Confirmar pago
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(order)}
                            disabled={updatingId === order._id}
                            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(order._id)}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
                        >
                          Detalle
                        </button>
                      </td>
                    </tr>
                    {expandedId === order._id && (
                      <tr className="bg-gray-50">
                        <td className="px-4 py-4" colSpan={6}>
                          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <div>
                              <h4 className="mb-2 text-sm font-semibold text-gray-700">Productos</h4>
                              <ul className="space-y-3 text-sm text-gray-600">
                                {order.items.map(item => {
                                  const productInfo = resolveProductInfo(item);
                                  const productId =
                                    productInfo?._id || item.product || item.title;
                                  return (
                                    <li
                                      key={`${order._id}-${productId}-${item.size || 'na'}-${item.color || 'na'}`}
                                      className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                                    >
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-semibold text-gray-700">
                                            {item.quantity} x {item.title}
                                          </span>
                                          <span className="text-sm text-gray-500">
                                            {formatCurrency(item.unitPrice)}
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                          Talla: {item.size || 'Unica'}
                                          {item.color ? ` · Color: ${item.color}` : ''}
                                        </p>
                                      </div>
                                      <dl className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                                        <div>
                                          <dt className="font-medium text-gray-700">Marca</dt>
                                          <dd>{productInfo?.brand || 'Sin dato'}</dd>
                                        </div>
                                        <div>
                                          <dt className="font-medium text-gray-700">Tipo</dt>
                                          <dd>{productInfo?.type || 'Sin dato'}</dd>
                                        </div>
                                        <div>
                                          <dt className="font-medium text-gray-700">Coleccion</dt>
                                          <dd>{productInfo?.collection || 'Sin dato'}</dd>
                                        </div>
                                        <div>
                                          <dt className="font-medium text-gray-700">Genero</dt>
                                          <dd>{productInfo?.gender || 'Sin dato'}</dd>
                                        </div>
                                      </dl>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                            <div>
                              <h4 className="mb-2 text-sm font-semibold text-gray-700">Datos del cliente</h4>
                              <dl className="space-y-2 text-sm text-gray-600">
                                <div>
                                  <dt className="font-medium">Nombre</dt>
                                  <dd>{order.contactName || 'Sin dato'}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">Telefono</dt>
                                  <dd>{order.contactPhone || 'Sin dato'}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">Correo</dt>
                                  <dd>{order.contactEmail || 'Sin dato'}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium">Direccion / referencia</dt>
                                  <dd>{order.contactAddress || 'Sin dato'}</dd>
                                </div>
                              </dl>
                            </div>
                            <div>
                              <h4 className="mb-2 text-sm font-semibold text-gray-700">Linea de tiempo</h4>
                              <ul className="space-y-1 text-sm text-gray-600">
                                {order.statusHistory?.length ? (
                                  order.statusHistory.map((entry, index) => (
                                    <li key={`${order._id}-history-${index}`}>
                                      <span className="font-medium">
                                        {formatOrderStatus(entry.status)}:
                                      </span>{' '}
                                      {formatDateTime(entry.changedAt)}
                                      {entry.note ? ` - ${entry.note}` : ''}
                                    </li>
                                  ))
                                ) : (
                                  <li>Sin historial</li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {otherOrders.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-800">Historial reciente</h3>
            <p className="text-sm text-gray-500">Ultimos pedidos actualizados.</p>
          </div>
          <div className="overflow-x-auto px-6 py-4">
            <table className="min-w-full text-sm text-gray-700">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Pedido</th>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-left">Total</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                  <th className="px-4 py-2 text-left">Actualizado</th>
                  <th className="px-4 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {otherOrders.slice(0, 10).map(order => {
                  const nextOptions = ORDER_STATUS_FLOW[order.status] || [];
                  const canAdvance = nextOptions.length > 0;
                  return (
                    <tr key={order._id}>
                      <td className="px-4 py-2 font-semibold">#{getOrderLabel(order)}</td>
                      <td className="px-4 py-2">{order.contactName || order.user?.name || 'Sin nombre'}</td>
                      <td className="px-4 py-2">{formatCurrency(order.total ?? order.subtotal)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getOrderStatusBadgeClass(order.status)}`}
                        >
                          {formatOrderStatus(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2">{formatDateTime(order.updatedAt)}</td>
                      <td className="px-4 py-2">
                        {canAdvance ? (
                          <button
                            type="button"
                            onClick={() => handleStatusUpdate(order)}
                            disabled={updatingId === order._id}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-60"
                          >
                            Cambiar estado
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Sin acciones</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidosPage;
