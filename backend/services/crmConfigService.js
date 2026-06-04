import CRMConfig from '../models/CRMConfig.js';

const DEFAULT_SUGGESTED_MESSAGES = {
  cart_abandoned:
    'Hola [nombre], vi que dejaste pendiente tu carrito con [producto]. ¿Te ayudo con la talla, color o forma de pago?',
  product_viewed:
    'Hola [nombre], vi que estabas revisando [producto]. ¿Te gustaria que te ayude con mas informacion?',
  stock_back_available:
    'Hola [nombre], ya tenemos disponible nuevamente [producto]. Te dejo el link para que puedas verlo.',
  post_sale:
    'Hola [nombre], gracias por tu compra. Queria confirmar si recibiste todo bien.'
};

const DEFAULT_CRM_CONFIG = {
  abandonedCartHours: 4,
  activeStatuses: [
    'visitor',
    'new_lead',
    'contacted',
    'link_sent',
    'interested',
    'cart_abandoned',
    'customer',
    'vip',
    'inactive',
    'lost'
  ],
  availableTags: [
    'frequent_customer',
    'vip',
    'cart_abandoned',
    'post_sale',
    'interested',
    'reactivation'
  ],
  suggestedMessages: DEFAULT_SUGGESTED_MESSAGES,
  postSaleFollowUpDays: 3,
  inactiveCustomerDays: 45,
  vipSpendThreshold: 250,
  lowStockThreshold: 5,
  frequentCustomerOrdersThreshold: 3,
  trackingEnabled: true
};

export const ensureDefaultCRMConfig = async () => {
  let config = await CRMConfig.findOne({ singletonKey: 'default' });
  if (!config) {
    config = await CRMConfig.create({
      singletonKey: 'default',
      ...DEFAULT_CRM_CONFIG
    });
    return config;
  }

  let changed = false;
  Object.entries(DEFAULT_CRM_CONFIG).forEach(([key, value]) => {
    const current = config.get(key);
    const isEmptyMap = current instanceof Map && current.size === 0;
    const isEmptyArray = Array.isArray(current) && current.length === 0;
    if (current === undefined || current === null || current === '' || isEmptyMap || isEmptyArray) {
      config.set(key, value);
      changed = true;
    }
  });

  if (changed) {
    await config.save();
  }

  return config;
};

export const getCRMConfig = () => ensureDefaultCRMConfig();
