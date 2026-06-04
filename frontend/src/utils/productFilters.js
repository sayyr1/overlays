const FILTER_STATE_KEYS = [
  'brand',
  'type',
  'gender',
  'size',
  'collection',
  'minPrice',
  'maxPrice',
  'onSale'
];

export const DEFAULT_FILTER_STATE = {
  brand: '',
  type: '',
  gender: '',
  size: '',
  collection: '',
  minPrice: '',
  maxPrice: '',
  onSale: false
};

const normalizeValueForState = (key, value) => {
  if (key === 'onSale') {
    return Boolean(value);
  }

  if (key === 'minPrice' || key === 'maxPrice') {
    if (value === undefined || value === null || value === '') {
      return '';
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : '';
    }
    const normalized = String(value).trim();
    return normalized;
  }

  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return String(value);
};

const normalizeValueForComparison = (key, value) => {
  if (key === 'onSale') {
    return Boolean(value);
  }
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return String(value);
};

export const normalizeFiltersForState = (input = {}) => {
  const source = input && typeof input === 'object' ? input : {};
  const normalized = { ...DEFAULT_FILTER_STATE };
  FILTER_STATE_KEYS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      normalized[key] = normalizeValueForState(key, source[key]);
    }
  });
  return normalized;
};

export const areFiltersDifferent = (a = {}, b = {}) => {
  const keys = new Set([...FILTER_STATE_KEYS, ...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of keys) {
    if (normalizeValueForComparison(key, a?.[key]) !== normalizeValueForComparison(key, b?.[key])) {
      return true;
    }
  }
  return false;
};

export const sanitizeFiltersForQuery = filters => {
  const source = filters && typeof filters === 'object' ? filters : {};
  const payload = {};

  FILTER_STATE_KEYS.forEach(key => {
    const raw = source[key];
    switch (key) {
      case 'onSale': {
        const isTrue = raw === true || raw === 'true' || raw === 1 || raw === '1';
        if (isTrue) {
          payload.onSale = true;
        }
        break;
      }
      case 'minPrice':
      case 'maxPrice': {
        if (raw === '' || raw === undefined || raw === null) {
          break;
        }
        const numeric = Number(raw);
        if (!Number.isNaN(numeric)) {
          payload[key] = numeric;
        }
        break;
      }
      default: {
        if (raw === undefined || raw === null) {
          break;
        }
        const value = String(raw).trim();
        if (value) {
          payload[key] = value;
        }
      }
    }
  });

  return payload;
};

export const buildProductFilterSearch = filters => {
  const sanitized = sanitizeFiltersForQuery(filters);
  const params = new URLSearchParams();

  Object.entries(sanitized).forEach(([key, value]) => {
    if (key === 'onSale') {
      params.set(key, 'true');
    } else {
      params.set(key, String(value));
    }
  });

  return params.toString();
};

export const buildProductFilterUrl = (filters, basePath = '/productos') => {
  const search = buildProductFilterSearch(filters);
  return search ? `${basePath}?${search}` : basePath;
};
