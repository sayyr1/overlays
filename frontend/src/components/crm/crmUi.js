const STATUS_META = {
  visitor: {
    label: 'Visitante',
    badgeClassName: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
    cardClassName: 'border-slate-200 bg-white'
  },
  new_lead: {
    label: 'Lead nuevo',
    badgeClassName: 'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200',
    cardClassName: 'border-sky-200 bg-sky-50/70'
  },
  contacted: {
    label: 'Contactado',
    badgeClassName: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    cardClassName: 'border-emerald-200 bg-emerald-50/70'
  },
  link_sent: {
    label: 'Link enviado',
    badgeClassName: 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200',
    cardClassName: 'border-indigo-200 bg-indigo-50/70'
  },
  interested: {
    label: 'Interesado',
    badgeClassName: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200',
    cardClassName: 'border-amber-200 bg-amber-50/70'
  },
  cart_abandoned: {
    label: 'Carrito abandonado',
    badgeClassName: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200',
    cardClassName: 'border-rose-200 bg-rose-50/70'
  },
  customer: {
    label: 'Cliente',
    badgeClassName: 'bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200',
    cardClassName: 'border-violet-200 bg-violet-50/70'
  },
  vip: {
    label: 'VIP',
    badgeClassName: 'bg-fuchsia-100 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200',
    cardClassName: 'border-fuchsia-200 bg-fuchsia-50/70'
  },
  inactive: {
    label: 'Inactivo',
    badgeClassName: 'bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200',
    cardClassName: 'border-stone-200 bg-stone-50/70'
  },
  lost: {
    label: 'Perdido',
    badgeClassName: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200',
    cardClassName: 'border-red-200 bg-red-50/70'
  }
};

const TASK_STATUS_META = {
  pending: {
    label: 'Pendiente',
    badgeClassName: 'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200'
  },
  done: {
    label: 'Hecha',
    badgeClassName: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200'
  },
  cancelled: {
    label: 'Cancelada',
    badgeClassName: 'bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200'
  },
  overdue: {
    label: 'Vencida',
    badgeClassName: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200'
  }
};

const TASK_PRIORITY_META = {
  low: {
    label: 'Baja',
    badgeClassName: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
  },
  medium: {
    label: 'Media',
    badgeClassName: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200'
  },
  high: {
    label: 'Alta',
    badgeClassName: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200'
  }
};

const CART_STATUS_META = {
  abandoned: {
    label: 'Pendiente',
    badgeClassName: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200'
  },
  contacted: {
    label: 'Contactado',
    badgeClassName: 'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200'
  },
  recovered: {
    label: 'Recuperado',
    badgeClassName: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200'
  },
  discarded: {
    label: 'Descartado',
    badgeClassName: 'bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200'
  }
};

const EVENT_META = {
  store_visited: { label: 'Visito la tienda', toneClassName: 'text-slate-600' },
  product_viewed: { label: 'Vio un producto', toneClassName: 'text-sky-700' },
  product_added_to_cart: { label: 'Agrego al carrito', toneClassName: 'text-indigo-700' },
  cart_created: { label: 'Creo carrito', toneClassName: 'text-indigo-700' },
  cart_abandoned: { label: 'Abandono carrito', toneClassName: 'text-rose-700' },
  checkout_started: { label: 'Inicio checkout', toneClassName: 'text-amber-700' },
  whatsapp_clicked: { label: 'Hizo clic en WhatsApp', toneClassName: 'text-emerald-700' },
  phone_entered: { label: 'Dejo su telefono', toneClassName: 'text-cyan-700' },
  order_created: { label: 'Creo pedido', toneClassName: 'text-violet-700' },
  order_paid: { label: 'Pedido pagado', toneClassName: 'text-emerald-700' },
  stock_back_available: { label: 'Stock disponible', toneClassName: 'text-teal-700' },
  manual_contact_done: { label: 'Gestion manual', toneClassName: 'text-slate-700' },
  follow_up_created: { label: 'Seguimiento creado', toneClassName: 'text-fuchsia-700' },
  product_interest_registered: { label: 'Interes detectado', toneClassName: 'text-amber-700' }
};

const SOURCE_LABELS = {
  whatsapp_click: 'WhatsApp',
  checkout: 'Checkout',
  form: 'Formulario',
  manual: 'Manual',
  campaign: 'Campana',
  returning_customer: 'Recompra'
};

export const formatCRMDate = value =>
  value ? new Date(value).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

export const formatCRMDateTime = value =>
  value
    ? new Date(value).toLocaleString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '--';

export const formatCRMCurrency = value => `USD ${Number(value || 0).toFixed(2)}`;

export const getCRMStatusMeta = status => STATUS_META[status] || {
  label: status || 'Sin estado',
  badgeClassName: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
  cardClassName: 'border-slate-200 bg-white'
};

export const getCRMTaskStatusMeta = status => TASK_STATUS_META[status] || {
  label: status || 'Sin estado',
  badgeClassName: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
};

export const getCRMTaskPriorityMeta = priority => TASK_PRIORITY_META[priority] || {
  label: priority || 'Media',
  badgeClassName: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
};

export const getCartStatusMeta = status => CART_STATUS_META[status] || {
  label: status || 'Sin estado',
  badgeClassName: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
};

export const getCRMEventMeta = eventType => EVENT_META[eventType] || {
  label: eventType || 'Evento',
  toneClassName: 'text-slate-700'
};

export const getCRMSourceLabel = source => SOURCE_LABELS[source] || source || 'Directo';

export const getContactPrimaryChannel = contact =>
  contact?.phone || contact?.whatsapp || contact?.email || 'Sin dato de contacto';

export const getContactSecondaryChannel = contact => {
  const parts = [getCRMSourceLabel(contact?.source), contact?.medium || 'organico'];
  return parts.filter(Boolean).join(' / ');
};

export const getActionableContactCount = contacts =>
  contacts.filter(contact =>
    ['new_lead', 'contacted', 'link_sent', 'interested', 'cart_abandoned', 'inactive'].includes(contact.status)
  ).length;

export const getContactValueTier = contact => {
  const total = Number(contact?.totalSpent || 0);
  if (total >= 400) return 'Cuenta fuerte';
  if (total >= 120) return 'Buen potencial';
  if ((contact?.ordersCount || 0) > 0) return 'Cliente activo';
  return 'Prospecto';
};
