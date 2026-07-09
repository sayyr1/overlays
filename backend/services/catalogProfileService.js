import Category from '../models/Category.js';
import { getSystemSettings } from './systemConfigService.js';

const DEFAULT_CATEGORY_KEYS = ['brand', 'type', 'size', 'collection', 'gender', 'color'];

const CATALOG_PROFILE_PRESETS = {
  footwear: {
    key: 'footwear',
    label: 'Zapatos',
    description: 'Preset recomendado para calzado, sneakers y sandalias.',
    recommendedFor: ['Zapaterias', 'Sneakers', 'Calzado casual'],
    valuesByKey: {
      brand: ['Nike', 'Adidas', 'Puma', 'New Balance'],
      size: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
      collection: ['Core', 'Running', 'Casual', 'Urbano'],
      gender: ['Unisex', 'Hombre', 'Mujer', 'Nino', 'Nina'],
      color: ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Beige']
    },
    brandModels: {
      Nike: ['Air Max', 'Court Vision', 'Dunk'],
      Adidas: ['Superstar', 'Forum', 'Runfalcon'],
      Puma: ['Suede', 'Smash', 'Carina'],
      'New Balance': ['530', '574', '9060']
    }
  },
  apparel: {
    key: 'apparel',
    label: 'Ropa',
    description: 'Preset recomendado para ropa, moda y colecciones textiles.',
    recommendedFor: ['Boutiques', 'Streetwear', 'Moda casual'],
    valuesByKey: {
      brand: ['Zara', 'Nike', 'Adidas', "Levi's"],
      type: ['Camiseta', 'Hoodie', 'Jean', 'Chaqueta', 'Short'],
      size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      collection: ['Basicos', 'Temporada', 'Casual', 'Deportivo'],
      gender: ['Unisex', 'Hombre', 'Mujer', 'Nino', 'Nina'],
      color: ['Negro', 'Blanco', 'Azul', 'Verde', 'Beige', 'Rosa'],
      material: ['Algodon', 'Denim', 'Poliester', 'Lino'],
      season: ['Primavera', 'Verano', 'Otono', 'Invierno']
    },
    brandModels: {
      Zara: ['Basic Tee', 'Relaxed Fit', 'Overshirt'],
      Nike: ['Dri-FIT', 'Club Fleece', 'Windrunner'],
      Adidas: ['Essentials', 'Tiro', 'Originals'],
      "Levi's": ['501', '511', 'Trucker']
    }
  },
  custom: {
    key: 'custom',
    label: 'Base limpia',
    description: 'Arranque neutro para construir la taxonomia desde cero.',
    recommendedFor: ['Catalogos mixtos', 'Tiendas especializadas', 'Implementaciones a medida'],
    valuesByKey: {
      brand: [],
      type: [],
      size: [],
      collection: [],
      gender: ['Unisex', 'Hombre', 'Mujer', 'Nino', 'Nina'],
      color: []
    },
    brandModels: {}
  }
};

const normalizeEntry = value => String(value ?? '').trim();
const uniqueStrings = values => Array.from(new Set(values.map(normalizeEntry).filter(Boolean)));

const sanitizeCategoryMaps = (valuesByKey, brandModels) => {
  const nextValues = toPlainCategoryMap(valuesByKey);
  const nextBrandModels = toPlainBrandModelMap(brandModels);
  const knownBrands = uniqueStrings([
    ...(nextValues.brand || []),
    ...Object.keys(nextBrandModels)
  ]);
  const blockedTypeValues = new Set(
    Object.values(nextBrandModels)
      .flat()
      .map(value => normalizeEntry(value).toLowerCase())
      .filter(Boolean)
  );

  nextValues.brand = knownBrands;
  nextValues.type = uniqueStrings(nextValues.type || []).filter(
    value => !blockedTypeValues.has(normalizeEntry(value).toLowerCase())
  );

  knownBrands.forEach(brand => {
    if (!Object.prototype.hasOwnProperty.call(nextBrandModels, brand)) {
      nextBrandModels[brand] = [];
    }
  });

  return {
    valuesByKey: nextValues,
    brandModels: nextBrandModels
  };
};

const ensureCategoryDocument = async () => {
  let doc = await Category.findOne();

  if (!doc) {
    const valuesByKey = {};
    DEFAULT_CATEGORY_KEYS.forEach(key => {
      valuesByKey[key] = [];
    });
    doc = await Category.create({ valuesByKey, brandModels: {} });
    return doc;
  }

  let changed = false;

  DEFAULT_CATEGORY_KEYS.forEach(key => {
    if (!doc.valuesByKey.has(key)) {
      doc.valuesByKey.set(key, []);
      changed = true;
    }
  });

  if (!doc.brandModels) {
    doc.brandModels = new Map();
    changed = true;
  }

  const sanitized = sanitizeCategoryMaps(doc.valuesByKey, doc.brandModels);
  const serializedValues = JSON.stringify(toPlainCategoryMap(doc.valuesByKey));
  const serializedBrandModels = JSON.stringify(toPlainBrandModelMap(doc.brandModels));
  const sanitizedValues = JSON.stringify(sanitized.valuesByKey);
  const sanitizedBrandModels = JSON.stringify(sanitized.brandModels);

  if (serializedValues !== sanitizedValues || serializedBrandModels !== sanitizedBrandModels) {
    doc.valuesByKey = new Map(
      Object.entries(sanitized.valuesByKey).map(([key, values]) => [key, uniqueStrings(values)])
    );
    doc.brandModels = new Map(
      Object.entries(sanitized.brandModels).map(([brand, models]) => [brand, uniqueStrings(models)])
    );
    changed = true;
  }

  if (changed) {
    await doc.save();
  }

  return doc;
};

const toPlainCategoryMap = valuesByKey => {
  const response = {};
  const source = valuesByKey instanceof Map ? valuesByKey : new Map(Object.entries(valuesByKey || {}));

  for (const [key, value] of source.entries()) {
    response[key] = uniqueStrings(Array.isArray(value) ? value : []);
  }

  DEFAULT_CATEGORY_KEYS.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(response, key)) {
      response[key] = [];
    }
  });

  return response;
};

const toPlainBrandModelMap = brandModels => {
  const response = {};
  const source = brandModels instanceof Map ? brandModels : new Map(Object.entries(brandModels || {}));

  for (const [brand, models] of source.entries()) {
    response[brand] = uniqueStrings(Array.isArray(models) ? models : []);
  }

  return response;
};

const buildPresetPayload = presetKey => {
  const preset = CATALOG_PROFILE_PRESETS[presetKey] || CATALOG_PROFILE_PRESETS.footwear;
  const { valuesByKey, brandModels } = sanitizeCategoryMaps(
    preset.valuesByKey,
    preset.brandModels
  );

  return {
    preset,
    valuesByKey,
    brandModels
  };
};

const buildCategoryStats = (categories, brandModels) => {
  const keys = Object.keys(categories || {});
  const totalValues = keys.reduce((acc, key) => acc + ((categories[key] || []).length), 0);
  const customKeys = keys.filter(key => !DEFAULT_CATEGORY_KEYS.includes(key));
  const totalBrandModels = Object.values(brandModels || {}).reduce(
    (acc, items) => acc + (Array.isArray(items) ? items.length : 0),
    0
  );

  return {
    totalKeys: keys.length,
    totalValues,
    customKeys: customKeys.length,
    customKeyNames: customKeys.sort((left, right) => left.localeCompare(right)),
    totalBrandModels
  };
};

const serializePreset = preset => {
  const { valuesByKey, brandModels } = buildPresetPayload(preset.key);

  return {
    key: preset.key,
    label: preset.label,
    description: preset.description,
    recommendedFor: preset.recommendedFor,
    categoryKeys: Object.keys(valuesByKey).sort((left, right) => left.localeCompare(right)),
    sizePreview: (valuesByKey.size || []).slice(0, 8),
    sampleBrands: (valuesByKey.brand || []).slice(0, 6),
    usesBrandModels: Object.keys(brandModels).length > 0,
    totalBrandModels: Object.values(brandModels).reduce(
      (acc, items) => acc + (Array.isArray(items) ? items.length : 0),
      0
    )
  };
};

export const getCatalogProfilesPayload = async () => {
  const settings = await getSystemSettings();
  const categoryDoc = await ensureCategoryDocument();
  const { valuesByKey: categories, brandModels } = sanitizeCategoryMaps(
    categoryDoc.valuesByKey,
    categoryDoc.brandModels
  );

  return {
    currentProfile: {
      key: settings.catalogProfile || 'footwear',
      label: settings.catalogProfileLabel || CATALOG_PROFILE_PRESETS[settings.catalogProfile]?.label || 'Zapatos'
    },
    stats: buildCategoryStats(categories, brandModels),
    presets: Object.values(CATALOG_PROFILE_PRESETS).map(serializePreset)
  };
};

export const applyCatalogProfile = async ({ presetKey = 'footwear', mode = 'merge' } = {}) => {
  const requestedMode = ['merge', 'replace', 'reset'].includes(mode) ? mode : 'merge';
  const normalizedMode =
    presetKey === 'custom' && requestedMode === 'merge'
      ? 'reset'
      : requestedMode;
  const { preset, valuesByKey, brandModels } = buildPresetPayload(presetKey);
  const settings = await getSystemSettings();
  const categoryDoc = await ensureCategoryDocument();

  const currentValues = toPlainCategoryMap(categoryDoc.valuesByKey);
  const currentBrandModels = toPlainBrandModelMap(categoryDoc.brandModels);

  let nextValues = currentValues;
  let nextBrandModels = currentBrandModels;

  if (normalizedMode === 'merge') {
    nextValues = { ...currentValues };
    Object.entries(valuesByKey).forEach(([key, values]) => {
      nextValues[key] = uniqueStrings([...(nextValues[key] || []), ...values]);
    });

    nextBrandModels = { ...currentBrandModels };
    Object.entries(brandModels).forEach(([brand, models]) => {
      nextBrandModels[brand] = uniqueStrings([...(nextBrandModels[brand] || []), ...models]);
    });
  } else {
    nextValues = toPlainCategoryMap(valuesByKey);
    nextBrandModels = toPlainBrandModelMap(brandModels);
  }

  const sanitized = sanitizeCategoryMaps(nextValues, nextBrandModels);

  categoryDoc.valuesByKey = new Map(
    Object.entries(sanitized.valuesByKey).map(([key, values]) => [key, uniqueStrings(values)])
  );
  categoryDoc.brandModels = new Map(
    Object.entries(sanitized.brandModels).map(([brand, models]) => [brand, uniqueStrings(models)])
  );
  await categoryDoc.save();

  settings.catalogProfile = preset.key;
  settings.catalogProfileLabel = preset.label;
  await settings.save();

  return {
    preset: {
      key: preset.key,
      label: preset.label
    },
    mode: normalizedMode,
    settings,
    categories: sanitizeCategoryMaps(categoryDoc.valuesByKey, categoryDoc.brandModels).valuesByKey,
    brandModels: sanitizeCategoryMaps(categoryDoc.valuesByKey, categoryDoc.brandModels).brandModels,
    stats: buildCategoryStats(
      sanitizeCategoryMaps(categoryDoc.valuesByKey, categoryDoc.brandModels).valuesByKey,
      sanitizeCategoryMaps(categoryDoc.valuesByKey, categoryDoc.brandModels).brandModels
    )
  };
};
