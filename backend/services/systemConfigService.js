import SystemSettings from '../models/SystemSettings.js';
import BrandingSettings from '../models/BrandingSettings.js';
import ModuleConfig from '../models/ModuleConfig.js';
import PaymentMethod from '../models/PaymentMethod.js';
import TextSetting from '../models/TextSetting.js';
import { ensureDefaultCRMConfig } from './crmConfigService.js';

const DEFAULT_SYSTEM_SETTINGS = {
  businessName: 'Tu negocio',
  tradeName: 'Tu tienda',
  country: 'Ecuador',
  currency: 'USD',
  timezone: 'America/Guayaquil',
  contactEmail: '',
  phone: '',
  whatsapp: '',
  address: '',
  socialLinks: {},
  footerText: 'Todos los derechos reservados.',
  enableInternalProductImages: false
};

const DEFAULT_BRANDING_SETTINGS = {
  logoUrl: '',
  faviconUrl: '',
  navbarName: 'Tu tienda',
  primaryColor: '#0f766e',
  secondaryColor: '#111827',
  backgroundColor: '#0b1220',
  textColor: '#0f172a',
  visualStyle: 'default'
};

const DEFAULT_MODULES = [
  ['ecommerce', 'E-commerce', 'Tienda publica y experiencia comercial', true, 'active', 1],
  ['products', 'Productos', 'Catalogo y fichas de producto', true, 'active', 2],
  ['inventory', 'Inventario', 'Stock y variantes', true, 'active', 3],
  ['orders', 'Pedidos', 'Gestion de ordenes', true, 'active', 4],
  ['customers', 'Clientes', 'Usuarios compradores y segmentacion', true, 'active', 5],
  ['crm', 'CRM', 'Centro de clientes, leads, tareas y seguimiento comercial', true, 'active', 6],
  ['categories', 'Categorias', 'Taxonomia y filtros', true, 'active', 7],
  ['brands', 'Marcas', 'Gestion de marcas', true, 'active', 8],
  ['menu', 'Menu', 'Navegacion y mega menu', true, 'active', 9],
  ['reports', 'Reportes', 'KPIs y analitica operativa', true, 'active', 10],
  ['payments', 'Pagos', 'Metodos de pago visibles', true, 'active', 11],
  ['memberships', 'Membresias', 'Precios por nivel de cliente', true, 'active', 12],
  ['suppliers', 'Proveedores', 'Proxima etapa', false, 'coming_soon', 13],
  ['purchases', 'Compras', 'Proxima etapa', false, 'coming_soon', 14],
  ['invoices', 'Facturas', 'Proxima etapa', false, 'coming_soon', 15],
  ['accounting', 'Contabilidad', 'Proxima etapa', false, 'coming_soon', 16]
].map(([key, label, description, enabled, status, order]) => ({
  key,
  label,
  description,
  enabled,
  status,
  order
}));

const DEFAULT_TEXT_SETTINGS = [
  ['product_primary_button', 'Texto boton principal de producto', 'Agregar al carrito', 'storefront', 'CTA principal del producto'],
  ['checkout_title', 'Texto de checkout', 'Generar pedido', 'checkout', 'Texto principal del checkout'],
  ['order_created_message', 'Mensaje de pedido creado', 'Tu pedido fue creado correctamente.', 'checkout', 'Mensaje posterior a creacion'],
  ['payment_instructions', 'Instrucciones de pago', 'Completa el pago usando uno de los metodos activos y comparte el comprobante.', 'checkout', 'Ayuda para el pago'],
  ['send_receipt_message', 'Mensaje para enviar comprobante', 'Envia tu comprobante indicando tu numero de pedido.', 'checkout', 'Mensaje post pago'],
  ['footer_text', 'Texto del footer', 'Todos los derechos reservados.', 'storefront', 'Texto principal del pie de pagina'],
  ['contact_text', 'Texto de contacto', 'Contactanos para soporte y seguimiento de pedidos.', 'storefront', 'Texto corto de contacto']
].map(([key, label, value, group, description]) => ({
  key,
  label,
  value,
  group,
  description
}));

const DEFAULT_PAYMENT_METHODS = [
  {
    name: 'Transferencia bancaria',
    type: 'bank_transfer',
    enabled: true,
    instructions: 'Realiza la transferencia y comparte el comprobante con tu numero de pedido.',
    displayOrder: 1
  },
  {
    name: 'WhatsApp / Manual',
    type: 'whatsapp_manual',
    enabled: true,
    instructions: 'Coordina el pago y envio directamente por WhatsApp.',
    displayOrder: 2
  }
];

const ensureSingleton = async (Model, payload) => {
  let document = await Model.findOne({ singletonKey: 'default' });
  if (!document) {
    document = await Model.create({ singletonKey: 'default', ...payload });
    return document;
  }

  let changed = false;
  Object.entries(payload).forEach(([key, value]) => {
    const current = document.get(key);
    const isEmptyMap = current instanceof Map && current.size === 0;
    if (current === undefined || current === null || current === '' || isEmptyMap) {
      document.set(key, value);
      changed = true;
    }
  });

  if (changed) {
    await document.save();
  }

  return document;
};

const ensureCollectionDefaults = async (Model, items, uniqueField = 'key') => {
  for (const item of items) {
    const query = { [uniqueField]: item[uniqueField] };
    const existing = await Model.findOne(query);
    if (!existing) {
      await Model.create(item);
    }
  }
};

export const ensureDefaultSettings = async () => {
  await ensureSingleton(SystemSettings, DEFAULT_SYSTEM_SETTINGS);
  await ensureSingleton(BrandingSettings, DEFAULT_BRANDING_SETTINGS);
  await ensureCollectionDefaults(ModuleConfig, DEFAULT_MODULES, 'key');
  await ensureCollectionDefaults(TextSetting, DEFAULT_TEXT_SETTINGS, 'key');
  await ensureDefaultCRMConfig();

  const existingPaymentMethods = await PaymentMethod.countDocuments();
  if (existingPaymentMethods === 0) {
    await PaymentMethod.insertMany(DEFAULT_PAYMENT_METHODS);
  }
};

export const getSystemSettings = () => ensureSingleton(SystemSettings, DEFAULT_SYSTEM_SETTINGS);

export const getBrandingSettings = () => ensureSingleton(BrandingSettings, DEFAULT_BRANDING_SETTINGS);

export const getModuleConfigs = () => ModuleConfig.find().sort({ order: 1, label: 1 });

export const getTextSettings = () => TextSetting.find().sort({ group: 1, label: 1 });

export const getPaymentMethods = (onlyEnabled = false) => {
  const query = onlyEnabled ? { enabled: true } : {};
  return PaymentMethod.find(query).sort({ displayOrder: 1, name: 1 });
};
