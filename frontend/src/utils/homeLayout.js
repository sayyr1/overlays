export const HOME_SECTION_TYPES = [
  'hero',
  'new_arrivals',
  'featured_products',
  'categories',
  'brands',
  'collections',
  'origins'
];

export const HOME_SECTION_LIBRARY = {
  hero: {
    type: 'hero',
    label: 'Hero principal',
    description: 'Portada principal con mensaje y CTAs.',
    requires: ['products'],
    supportsLimit: false,
    defaults: {
      title: '',
      eyebrow: '',
      linkTo: '',
      linkLabel: '',
      limit: 0,
      settings: {
        title: 'Portadas que venden colecciones, no dashboards.',
        eyebrow: 'Coleccion destacada',
        description: 'Explora lanzamientos, favoritos y selecciones curadas en una vitrina visual mas limpia.',
        primaryCtaLabel: 'Comprar ahora',
        primaryCtaTo: '/productos',
        secondaryCtaLabel: 'Ver colecciones',
        secondaryCtaTo: '/productos?onSale=true'
      }
    }
  },
  new_arrivals: {
    type: 'new_arrivals',
    label: 'Nuevos',
    description: 'Productos agregados recientemente.',
    requires: ['products'],
    supportsLimit: true,
    defaults: {
      title: 'Nuevos',
      eyebrow: '',
      linkTo: '/nuevos',
      linkLabel: 'Ver mas',
      limit: 12,
      settings: {}
    }
  },
  featured_products: {
    type: 'featured_products',
    label: 'Ofertas',
    description: 'Productos con descuento o promocion.',
    requires: ['products'],
    supportsLimit: true,
    defaults: {
      title: 'Ofertas',
      eyebrow: '',
      linkTo: '/ofertas',
      linkLabel: 'Ver mas',
      limit: 12,
      settings: {}
    }
  },
  categories: {
    type: 'categories',
    label: 'Categorias',
    description: 'Exploracion principal segun el perfil del catalogo.',
    requires: ['products', 'categories'],
    supportsLimit: true,
    defaults: {
      title: '',
      eyebrow: '',
      linkTo: '/categorias',
      linkLabel: 'Ver mas',
      limit: 6,
      settings: {}
    }
  },
  brands: {
    type: 'brands',
    label: 'Marcas',
    description: 'Ranking visual de marcas presentes.',
    requires: ['products'],
    supportsLimit: true,
    defaults: {
      title: 'Marcas',
      eyebrow: '',
      linkTo: '/marcas',
      linkLabel: 'Ver mas',
      limit: 6,
      settings: {}
    }
  },
  collections: {
    type: 'collections',
    label: 'Colecciones',
    description: 'Agrupacion por coleccion.',
    requires: ['products'],
    supportsLimit: true,
    defaults: {
      title: 'Coleccion',
      eyebrow: '',
      linkTo: '/colecciones',
      linkLabel: 'Ver mas',
      limit: 6,
      settings: {}
    }
  },
  origins: {
    type: 'origins',
    label: 'Origen',
    description: 'Exploracion por origen o procedencia.',
    requires: ['products', 'categories'],
    supportsLimit: true,
    defaults: {
      title: 'Origen',
      eyebrow: '',
      linkTo: '/origen',
      linkLabel: 'Ver mas',
      limit: 6,
      settings: {}
    }
  }
};

export const DEFAULT_HOME_SECTION_ORDER = [
  'hero',
  'new_arrivals',
  'featured_products',
  'categories',
  'brands',
  'collections',
  'origins'
];

const createId = () =>
  typeof window !== 'undefined' && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `home-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const sortHomeSections = sections =>
  [...(Array.isArray(sections) ? sections : [])].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

export const withSequentialHomeOrder = sections =>
  sortHomeSections(sections).map((section, index) => ({ ...section, order: index }));

export const createHomeSection = (type, overrides = {}) => {
  const template = HOME_SECTION_LIBRARY[type];
  if (!template) {
    return null;
  }

  return {
    id: overrides.id || createId(),
    type,
    enabled: overrides.enabled ?? true,
    title: overrides.title ?? template.defaults.title,
    eyebrow: overrides.eyebrow ?? template.defaults.eyebrow,
    linkTo: overrides.linkTo ?? template.defaults.linkTo,
    linkLabel: overrides.linkLabel ?? template.defaults.linkLabel,
    limit: overrides.limit ?? template.defaults.limit,
    order: overrides.order ?? 0,
    settings: {
      ...(template.defaults.settings || {}),
      ...((overrides.settings && typeof overrides.settings === 'object') ? overrides.settings : {})
    }
  };
};

export const createDefaultHomeSections = () =>
  DEFAULT_HOME_SECTION_ORDER.map((type, index) =>
    createHomeSection(type, { order: index })
  );

export const normalizeHomeSections = sections => {
  const safeSections = Array.isArray(sections) ? sections : [];
  const normalized = safeSections
    .map((section, index) => createHomeSection(section?.type, { ...section, order: section?.order ?? index }))
    .filter(Boolean);

  return withSequentialHomeOrder(normalized.length ? normalized : createDefaultHomeSections());
};

export const getHomeSectionMeta = type =>
  HOME_SECTION_LIBRARY[type] || null;
