const ORDER_STATUS_META = {
  PENDIENTE_PAGO: {
    label: 'Pendiente de pago',
    badgeClass: 'bg-amber-100 text-amber-700'
  },
  PAGADO: {
    label: 'Pagado',
    badgeClass: 'bg-emerald-100 text-emerald-700'
  },
  EN_PREPARACION: {
    label: 'En preparacion',
    badgeClass: 'bg-sky-100 text-sky-700'
  },
  ENVIADO: {
    label: 'Enviado',
    badgeClass: 'bg-indigo-100 text-indigo-700'
  },
  ENTREGADO: {
    label: 'Entregado',
    badgeClass: 'bg-teal-100 text-teal-700'
  },
  CANCELADO: {
    label: 'Cancelado',
    badgeClass: 'bg-rose-100 text-rose-700'
  },
  EXPIRADO: {
    label: 'Expirado',
    badgeClass: 'bg-gray-200 text-gray-700'
  }
};

export const ORDER_STATUS_FLOW = {
  PAGADO: ['EN_PREPARACION', 'ENVIADO', 'ENTREGADO'],
  EN_PREPARACION: ['ENVIADO', 'ENTREGADO'],
  ENVIADO: ['ENTREGADO']
};

export const getOrderStatusMeta = status => {
  return ORDER_STATUS_META[status] || {
    label: status?.toLowerCase?.().replace?.(/_/g, ' ') || 'Sin estado',
    badgeClass: 'bg-gray-200 text-gray-700'
  };
};

export const formatOrderStatus = status => getOrderStatusMeta(status).label;

export const getOrderStatusBadgeClass = status => getOrderStatusMeta(status).badgeClass;
