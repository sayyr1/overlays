import SystemSettings from '../models/SystemSettings.js';
import BrandingSettings from '../models/BrandingSettings.js';
import ModuleConfig from '../models/ModuleConfig.js';
import PaymentMethod from '../models/PaymentMethod.js';
import TextSetting from '../models/TextSetting.js';
import ThemeSettings from '../models/ThemeSettings.js';
import FormDefinition from '../models/FormDefinition.js';
import HomeLayoutSettings from '../models/HomeLayoutSettings.js';
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
  catalogProfile: 'footwear',
  catalogProfileLabel: 'Zapatos',
  socialLinks: {},
  footerText: 'Todos los derechos reservados.',
  enableInternalProductImages: false
};

const DEFAULT_BRANDING_SETTINGS = {
  logoUrl: '',
  logoPublicId: '',
  faviconUrl: '',
  faviconPublicId: '',
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

const DEFAULT_THEMES = [
  {
    scope: 'storefront',
    label: 'Cliente / Tienda',
    primaryColor: '#78d64b',
    accentColor: '#f97316',
    backgroundColor: '#141414',
    surfaceColor: '#1c1c1c',
    textColor: '#f3f4f6',
    headingColor: '#ffffff',
    mutedColor: '#a1a1aa',
    fontBody: 'Inter',
    fontHeading: 'Playfair Display',
    buttonStyle: 'rounded',
    panelStyle: 'soft',
    formStyle: 'filled',
    navStyle: 'glass'
  },
  {
    scope: 'admin',
    label: 'Admin operativo',
    primaryColor: '#0f766e',
    accentColor: '#2563eb',
    backgroundColor: '#eef2f7',
    surfaceColor: '#ffffff',
    textColor: '#0f172a',
    headingColor: '#0f172a',
    mutedColor: '#64748b',
    fontBody: 'Inter',
    fontHeading: 'Inter',
    buttonStyle: 'rounded',
    panelStyle: 'solid',
    formStyle: 'outline',
    navStyle: 'solid'
  },
  {
    scope: 'superadmin',
    label: 'Super Admin',
    primaryColor: '#7c3aed',
    accentColor: '#f97316',
    backgroundColor: '#f4f1ff',
    surfaceColor: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    mutedColor: '#6b7280',
    fontBody: 'Inter',
    fontHeading: 'Playfair Display',
    buttonStyle: 'pill',
    panelStyle: 'soft',
    formStyle: 'outline',
    navStyle: 'solid'
  }
];

const DEFAULT_FORMS = [
  {
    key: 'contact_form',
    title: 'Formulario de contacto',
    description: 'Captura de contacto general para tienda o landing.',
    scope: 'storefront',
    enabled: true,
    submitLabel: 'Enviar mensaje',
    successMessage: 'Gracias. Tu mensaje fue preparado correctamente.',
    layout: 'grid',
    order: 0,
    fields: [
      {
        id: 'contact_name',
        name: 'name',
        label: 'Nombre',
        type: 'text',
        required: true,
        enabled: true,
        locked: true,
        placeholder: 'Tu nombre',
        helpText: '',
        defaultValue: '',
        width: 'half',
        order: 0,
        options: [],
        settings: {}
      },
      {
        id: 'contact_email',
        name: 'email',
        label: 'Correo',
        type: 'email',
        required: true,
        enabled: true,
        locked: true,
        placeholder: 'correo@ejemplo.com',
        helpText: '',
        defaultValue: '',
        width: 'half',
        order: 1,
        options: [],
        settings: {}
      },
      {
        id: 'contact_phone',
        name: 'phone',
        label: 'Telefono o WhatsApp',
        type: 'phone',
        required: false,
        enabled: true,
        locked: false,
        placeholder: '+593...',
        helpText: '',
        defaultValue: '',
        width: 'half',
        order: 2,
        options: [],
        settings: {}
      },
      {
        id: 'contact_message',
        name: 'message',
        label: 'Mensaje',
        type: 'textarea',
        required: true,
        enabled: true,
        locked: true,
        placeholder: 'Cuéntanos qué necesitas',
        helpText: '',
        defaultValue: '',
        width: 'full',
        order: 3,
        options: [],
        settings: { rows: 4 }
      }
    ]
  },
  {
    key: 'lead_capture',
    title: 'Captura de lead',
    description: 'Formulario breve para campañas y promociones.',
    scope: 'storefront',
    enabled: true,
    submitLabel: 'Quiero información',
    successMessage: 'Datos preparados para seguimiento comercial.',
    layout: 'grid',
    order: 1,
    fields: [
      {
        id: 'lead_name',
        name: 'name',
        label: 'Nombre',
        type: 'text',
        required: true,
        enabled: true,
        locked: false,
        placeholder: 'Nombre y apellido',
        helpText: '',
        defaultValue: '',
        width: 'half',
        order: 0,
        options: [],
        settings: {}
      },
      {
        id: 'lead_whatsapp',
        name: 'whatsapp',
        label: 'WhatsApp',
        type: 'phone',
        required: true,
        enabled: true,
        locked: false,
        placeholder: '+593...',
        helpText: '',
        defaultValue: '',
        width: 'half',
        order: 1,
        options: [],
        settings: {}
      },
      {
        id: 'lead_interest',
        name: 'interest',
        label: 'Interes principal',
        type: 'select',
        required: false,
        enabled: true,
        locked: false,
        placeholder: '',
        helpText: '',
        defaultValue: '',
        width: 'full',
        order: 2,
        options: [
          { label: 'Catalogo general', value: 'catalogo_general' },
          { label: 'Promociones', value: 'promociones' },
          { label: 'Mayoreo', value: 'mayoreo' }
        ],
        settings: {}
      }
    ]
  },
  {
    key: 'admin_product_create',
    title: 'Admin · Crear producto',
    description: 'Controla el orden y visibilidad de los bloques del formulario de alta.',
    scope: 'admin',
    enabled: true,
    submitLabel: 'Crear producto',
    successMessage: 'Configuracion del formulario de alta actualizada.',
    layout: 'stacked',
    order: 50,
    fields: [
      ['location', 'Ubicacion', 0],
      ['brand', 'Marca', 1],
      ['model', 'Modelo', 2],
      ['gender', 'Genero', 3],
      ['name', 'Nombre', 4],
      ['code', 'Codigo', 5],
      ['pricing', 'Precios', 6],
      ['collection', 'Coleccion', 7],
      ['dynamic_attributes', 'Atributos dinamicos', 8],
      ['inventory', 'Inventario', 9],
      ['on_sale', 'Oferta', 10],
      ['description', 'Descripcion', 11],
      ['images', 'Imagenes', 12]
    ].map(([name, label, order]) => ({
      id: `admin_product_create_${name}`,
      name,
      label,
      type: 'text',
      required: false,
      enabled: true,
      locked: false,
      placeholder: '',
      helpText: '',
      defaultValue: '',
      width: 'full',
      order,
      options: [],
      settings: {}
    }))
  },
  {
    key: 'admin_product_edit',
    title: 'Admin · Editar producto',
    description: 'Controla el orden y visibilidad de los bloques del formulario de edicion.',
    scope: 'admin',
    enabled: true,
    submitLabel: 'Guardar cambios',
    successMessage: 'Configuracion del formulario de edicion actualizada.',
    layout: 'stacked',
    order: 51,
    fields: [
      ['name', 'Nombre', 0],
      ['code', 'Codigo', 1],
      ['pricing', 'Precios', 2],
      ['brand', 'Marca', 3],
      ['model', 'Modelo', 4],
      ['collection', 'Coleccion', 5],
      ['gender', 'Genero', 6],
      ['dynamic_attributes', 'Atributos dinamicos', 7],
      ['inventory', 'Inventario', 8],
      ['on_sale', 'Oferta', 9],
      ['description', 'Descripcion', 10],
      ['images', 'Imagenes', 11]
    ].map(([name, label, order]) => ({
      id: `admin_product_edit_${name}`,
      name,
      label,
      type: 'text',
      required: false,
      enabled: true,
      locked: false,
      placeholder: '',
      helpText: '',
      defaultValue: '',
      width: 'full',
      order,
      options: [],
      settings: {}
    }))
  },
  {
    key: 'admin_category_manager',
    title: 'Admin · Gestion de categorias',
    description: 'Controla la visibilidad y orden de bloques del modulo de categorias.',
    scope: 'admin',
    enabled: true,
    submitLabel: 'Guardar',
    successMessage: 'Configuracion de categorias actualizada.',
    layout: 'stacked',
    order: 52,
    fields: [
      ['add_value', 'Agregar valor', 0],
      ['add_key', 'Crear clave nueva', 1],
      ['brand_model_form', 'Conectar modelos a marcas', 2],
      ['brand_model_map', 'Mapa marca -> modelos', 3],
      ['category_grid', 'Claves y valores', 4]
    ].map(([name, label, order]) => ({
      id: `admin_category_manager_${name}`,
      name,
      label,
      type: 'text',
      required: false,
      enabled: true,
      locked: false,
      placeholder: '',
      helpText: '',
      defaultValue: '',
      width: 'full',
      order,
      options: [],
      settings: {}
    }))
  }
];

const DEFAULT_HOME_LAYOUT = {
  sections: [
    {
      id: 'home_hero',
      type: 'hero',
      enabled: true,
      title: '',
      eyebrow: '',
      linkTo: '',
      linkLabel: '',
      limit: 0,
      order: 0,
      settings: {
        title: 'Portadas que venden colecciones, no dashboards.',
        eyebrow: 'Coleccion destacada',
        description: 'Explora lanzamientos, favoritos y selecciones curadas en una vitrina visual mas limpia.',
        primaryCtaLabel: 'Comprar ahora',
        primaryCtaTo: '/productos',
        secondaryCtaLabel: 'Ver colecciones',
        secondaryCtaTo: '/productos?onSale=true'
      }
    },
    {
      id: 'home_new_arrivals',
      type: 'new_arrivals',
      enabled: true,
      title: 'Nuevos',
      eyebrow: '',
      linkTo: '/nuevos',
      linkLabel: 'Ver mas',
      limit: 12,
      order: 1,
      settings: {}
    },
    {
      id: 'home_featured_products',
      type: 'featured_products',
      enabled: true,
      title: 'Ofertas',
      eyebrow: '',
      linkTo: '/ofertas',
      linkLabel: 'Ver mas',
      limit: 12,
      order: 2,
      settings: {}
    },
    {
      id: 'home_categories',
      type: 'categories',
      enabled: true,
      title: '',
      eyebrow: '',
      linkTo: '/categorias',
      linkLabel: 'Ver mas',
      limit: 6,
      order: 3,
      settings: {}
    },
    {
      id: 'home_brands',
      type: 'brands',
      enabled: true,
      title: 'Marcas',
      eyebrow: '',
      linkTo: '/marcas',
      linkLabel: 'Ver mas',
      limit: 6,
      order: 4,
      settings: {}
    },
    {
      id: 'home_collections',
      type: 'collections',
      enabled: true,
      title: 'Coleccion',
      eyebrow: '',
      linkTo: '/colecciones',
      linkLabel: 'Ver mas',
      limit: 6,
      order: 5,
      settings: {}
    },
    {
      id: 'home_origins',
      type: 'origins',
      enabled: true,
      title: 'Origen',
      eyebrow: '',
      linkTo: '/origen',
      linkLabel: 'Ver mas',
      limit: 6,
      order: 6,
      settings: {}
    }
  ]
};

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

const ensureFormDefaults = async items => {
  for (const item of items) {
    let document = await FormDefinition.findOne({ key: item.key });

    if (!document) {
      await FormDefinition.create(item);
      continue;
    }

    let changed = false;

    ['title', 'description', 'scope', 'enabled', 'submitLabel', 'successMessage', 'layout', 'order'].forEach(field => {
      if (document[field] === undefined || document[field] === null || document[field] === '') {
        document[field] = item[field];
        changed = true;
      }
    });

    const existingFields = Array.isArray(document.fields) ? document.fields : [];
    const existingFieldKeys = new Set(existingFields.map(field => `${field.id}::${field.name}`));
    const missingFields = (item.fields || []).filter(
      field => !existingFieldKeys.has(`${field.id}::${field.name}`)
    );

    if (missingFields.length) {
      document.fields = [...existingFields, ...missingFields];
      changed = true;
    }

    if (changed) {
      await document.save();
    }
  }
};

export const ensureDefaultSettings = async () => {
  await ensureSingleton(SystemSettings, DEFAULT_SYSTEM_SETTINGS);
  await ensureSingleton(BrandingSettings, DEFAULT_BRANDING_SETTINGS);
  await ensureSingleton(HomeLayoutSettings, DEFAULT_HOME_LAYOUT);
  await ensureCollectionDefaults(ModuleConfig, DEFAULT_MODULES, 'key');
  await ensureCollectionDefaults(TextSetting, DEFAULT_TEXT_SETTINGS, 'key');
  await ensureCollectionDefaults(ThemeSettings, DEFAULT_THEMES, 'scope');
  await ensureFormDefaults(DEFAULT_FORMS);
  await ensureDefaultCRMConfig();

  const existingPaymentMethods = await PaymentMethod.countDocuments();
  if (existingPaymentMethods === 0) {
    await PaymentMethod.insertMany(DEFAULT_PAYMENT_METHODS);
  }
};

export const getSystemSettings = () => ensureSingleton(SystemSettings, DEFAULT_SYSTEM_SETTINGS);

export const getBrandingSettings = () => ensureSingleton(BrandingSettings, DEFAULT_BRANDING_SETTINGS);

export const getHomeLayoutSettings = () => ensureSingleton(HomeLayoutSettings, DEFAULT_HOME_LAYOUT);

export const getModuleConfigs = () => ModuleConfig.find().sort({ order: 1, label: 1 });

export const getTextSettings = () => TextSetting.find().sort({ group: 1, label: 1 });

export const getPaymentMethods = (onlyEnabled = false) => {
  const query = onlyEnabled ? { enabled: true } : {};
  return PaymentMethod.find(query).sort({ displayOrder: 1, name: 1 });
};

export const getThemeSettings = (scope = null) => {
  if (scope) {
    return ThemeSettings.findOne({ scope });
  }

  return ThemeSettings.find().sort({ scope: 1 });
};

export const getFormDefinitions = ({ scope = null, enabledOnly = false } = {}) => {
  const query = {};

  if (scope) {
    query.scope = scope;
  }

  if (enabledOnly) {
    query.enabled = true;
  }

  return FormDefinition.find(query).sort({ order: 1, title: 1 });
};
