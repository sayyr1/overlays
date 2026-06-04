export const VARIANT_DELIMITER = '::';
export const DEFAULT_COLOR_LABEL = 'Sin color';

export const normalizeVariantColor = color => {
  const trimmed = (color ?? '').toString().trim();
  return trimmed || DEFAULT_COLOR_LABEL;
};

export const normalizeVariantSize = size =>
  (size ?? '').toString().trim().toUpperCase();

export const buildVariantKey = (color, size) =>
  `${normalizeVariantColor(color)}${VARIANT_DELIMITER}${normalizeVariantSize(size)}`;

export const splitVariantKey = key => {
  if (typeof key !== 'string') {
    return { color: DEFAULT_COLOR_LABEL, size: '' };
  }
  const [colorPart = DEFAULT_COLOR_LABEL, sizePart = ''] = key.split(
    VARIANT_DELIMITER
  );
  return {
    color: normalizeVariantColor(colorPart),
    size: normalizeVariantSize(sizePart)
  };
};

export const mapVariantsToNested = (variantObject = {}) => {
  const grouped = {};
  Object.entries(variantObject).forEach(([key, qty]) => {
    const { color, size } = splitVariantKey(key);
    if (!size) return;
    if (!grouped[color]) {
      grouped[color] = {};
    }
    grouped[color][size] = Number(qty) || 0;
  });
  return grouped;
};

export const flattenNestedVariants = (grouped = {}) => {
  const flat = {};
  Object.entries(grouped).forEach(([color, sizes = {}]) => {
    Object.entries(sizes).forEach(([size, qty]) => {
      const numeric = Number(qty);
      if (!Number.isFinite(numeric)) return;
      flat[buildVariantKey(color, size)] = numeric;
    });
  });
  return flat;
};

export const aggregateSizesFromVariants = variantObject => {
  const aggregate = {};
  Object.entries(variantObject || {}).forEach(([key, qty]) => {
    const { size } = splitVariantKey(key);
    if (!size) return;
    const numeric = Number(qty) || 0;
    aggregate[size] = (aggregate[size] || 0) + numeric;
  });
  return aggregate;
};

export const buildNestedVariantsWithFallback = (variantObject = {}, fallbackSizes = {}) => {
  const nested = mapVariantsToNested(variantObject);
  if (Object.keys(nested).length) {
    return nested;
  }

  const fallback = {};
  Object.entries(fallbackSizes || {}).forEach(([size, qty]) => {
    const normalizedSize = normalizeVariantSize(size);
    if (!normalizedSize) return;
    const numeric = Number(qty);
    if (!Number.isFinite(numeric)) return;
    if (!fallback[DEFAULT_COLOR_LABEL]) {
      fallback[DEFAULT_COLOR_LABEL] = {};
    }
    fallback[DEFAULT_COLOR_LABEL][normalizedSize] = numeric;
  });
  return fallback;
};

export const summarizeNestedVariants = (nested = {}) => {
  const summary = {
    total: 0,
    byColor: {}
  };

  Object.entries(nested).forEach(([color, sizes = {}]) => {
    const colorTotal = Object.values(sizes).reduce(
      (acc, qty) => acc + Number(qty || 0),
      0
    );
    summary.byColor[color] = colorTotal;
    summary.total += colorTotal;
  });

  return summary;
};

export const listAvailableSizesForColor = (nested = {}, color) => {
  const normalizedColor = normalizeVariantColor(color);
  const sizes = nested[normalizedColor] || {};
  return Object.keys(sizes);
};

export const hasVariantInventory = nested =>
  Object.values(nested || {}).some(colorSizes =>
    Object.values(colorSizes || {}).some(qty => Number(qty) > 0)
  );
