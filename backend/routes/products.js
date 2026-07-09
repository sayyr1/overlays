import express from 'express';
import Product from '../models/Product.js';
import upload from '../middleware/upload.js';
import cloudinary from '../utils/cloudinary.js';
import { protect, adminOnly, optionalProtect, requirePermission } from '../middleware/authMiddleware.js';
import { requireModuleEnabled } from '../middleware/moduleMiddleware.js';
import { handleProductBackInStock } from '../services/crmAutomationService.js';
import { getSystemSettings } from '../services/systemConfigService.js';

const router = express.Router();

router.use(requireModuleEnabled('products'));

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeString = value => (typeof value === 'string' ? value.trim() : '');
const prepareRegexArray = value => {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(normalizeString)
    .filter(Boolean)
    .map(item => new RegExp(`^${escapeRegex(item)}$`, 'i'));
};
const uniqueStrings = values => Array.from(new Set(values.map(normalizeString).filter(Boolean)));
const applyRegexFilter = (filter, key, value) => {
  const regexes = prepareRegexArray(value);
  if (!regexes.length) return;
  filter[key] = regexes.length === 1 ? regexes[0] : { $in: regexes };
};
const buildRegexMatchCondition = (key, value) => {
  const regexes = prepareRegexArray(value);
  if (!regexes.length) return null;
  return regexes.length === 1 ? { [key]: regexes[0] } : { [key]: { $in: regexes } };
};
const applyModelFilter = (filter, value) => {
  const modelCondition = buildRegexMatchCondition('model', value);
  const legacyTypeCondition = buildRegexMatchCondition('type', value);
  if (!modelCondition && !legacyTypeCondition) return;

  filter.$and = [
    ...(filter.$and || []),
    {
      $or: [modelCondition, legacyTypeCondition].filter(Boolean)
    }
  ];
};
const buildSizeConditions = value => {
  const values = Array.isArray(value) ? value : [value];
  const normalized = new Set();
  values.forEach(original => {
    const trimmed = normalizeString(original);
    if (!trimmed) return;
    normalized.add(trimmed);
    normalized.add(trimmed.toUpperCase());
    normalized.add(trimmed.toLowerCase());
  });
  return Array.from(normalized).map(sizeKey => ({
    [`stockBySize.${sizeKey}`]: { $gt: 0 }
  }));
};

const VARIANT_DELIMITER = '::';
const DEFAULT_COLOR_LABEL = 'Sin color';

const normalizeVariantColor = color => {
  const trimmed = (color ?? '').toString().trim();
  return trimmed || DEFAULT_COLOR_LABEL;
};

const normalizeVariantSize = size => (size ?? '').toString().trim().toUpperCase();

const buildVariantKey = (color, size) =>
  `${normalizeVariantColor(color)}${VARIANT_DELIMITER}${normalizeVariantSize(size)}`;

const splitVariantKey = key => {
  if (typeof key !== 'string') {
    return { color: DEFAULT_COLOR_LABEL, size: '' };
  }
  const [colorPart = DEFAULT_COLOR_LABEL, sizePart = ''] = key.split(VARIANT_DELIMITER);
  return {
    color: normalizeVariantColor(colorPart),
    size: normalizeVariantSize(sizePart)
  };
};

const ensureMap = value => {
  if (!value) return new Map();
  if (value instanceof Map) return value;
  if (Array.isArray(value)) return new Map(value);
  if (typeof value === 'object') return new Map(Object.entries(value));
  return new Map();
};

const adjustMapValue = (map, key, delta) => {
  if (!(map instanceof Map)) return;
  const current = Number(map.get(key) || 0);
  const next = current + delta;
  if (next <= 0) {
    map.delete(key);
  } else {
    map.set(key, next);
  }
};

const parseStockByColorSizePayload = raw => {
  const result = new Map();
  const addEntry = (color, size, quantity) => {
    const normalizedSize = normalizeVariantSize(size);
    if (!normalizedSize) return;
    const normalizedColor = normalizeVariantColor(color);
    const numeric = Number(quantity);
    if (!Number.isFinite(numeric) || numeric < 0) return;
    const key = buildVariantKey(normalizedColor, normalizedSize);
    result.set(key, numeric);
  };

  if (!raw) {
    return result;
  }

  if (Array.isArray(raw)) {
    raw.forEach(item => {
      if (!item) return;
      if (item.sizes && typeof item.sizes === 'object') {
        Object.entries(item.sizes).forEach(([size, qty]) => addEntry(item.color, size, qty));
      } else if (item.color !== undefined && item.size !== undefined) {
        addEntry(item.color, item.size, item.quantity ?? item.qty ?? item.value ?? 0);
      }
    });
    return result;
  }

  if (typeof raw === 'object') {
    Object.entries(raw).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Number.isFinite(value)) {
        Object.entries(value).forEach(([size, qty]) => addEntry(key, size, qty));
      } else {
        const { color, size } = splitVariantKey(key);
        addEntry(color, size, value);
      }
    });
  }

  return result;
};

const aggregateBySizeFromVariants = variantMap => {
  const map = ensureMap(variantMap);
  const aggregate = new Map();
  map.forEach((qty, key) => {
    const { size } = splitVariantKey(key);
    if (!size) return;
    const current = Number(aggregate.get(size) ?? 0);
    aggregate.set(size, current + Number(qty ?? 0));
  });
  return aggregate;
};

const uniqueColorsFromVariantMap = variantMap => {
  const map = ensureMap(variantMap);
  const colors = new Set();
  map.forEach((_, key) => {
    const { color } = splitVariantKey(key);
    if (color) colors.add(color);
  });
  return Array.from(colors);
};

const parsePricePayload = (rawPrice = {}) => {
  if (typeof rawPrice === 'number') {
    return {
      retail: rawPrice,
      gold: rawPrice,
      premium: rawPrice,
      platinum: rawPrice
    };
  }

  const retail = Number(rawPrice.retail ?? 0);
  const gold = Number(rawPrice.gold ?? retail);
  const premium = Number(rawPrice.premium ?? retail);
  const platinum = Number(rawPrice.platinum ?? retail);

  if ([retail, gold, premium, platinum].some(value => Number.isNaN(value) || value < 0)) {
    throw new Error('Precios invalidos');
  }

  return { retail, gold, premium, platinum };
};

const parseColorsPayload = colors => {
  if (!colors) return [];
  if (Array.isArray(colors)) {
    return colors.map(color => color?.trim()).filter(Boolean);
  }
  return String(colors)
    .split(',')
    .map(color => color.trim())
    .filter(Boolean);
};

const mapSizes = mapData => {
  if (!mapData) return {};
  if (mapData instanceof Map) return Object.fromEntries(mapData);
  return mapData;
};

const isInternalUser = user => Boolean(
  user?.role === 'superadmin' ||
  user?.role === 'owner' ||
  user?.role === 'sales' ||
  user?.role === 'admin' ||
  user?.isAdmin
);

const normalizeImageVisibility = visibility =>
  visibility === 'internal' ? 'internal' : 'public';

const normalizeStoreVisibility = visibility =>
  visibility === 'public' ? 'public' : 'internal';

const parseImagesPayload = images =>
  (Array.isArray(images) ? images : [])
    .filter(image => image?.url && image?.public_id)
    .map(image => ({
      url: image.url,
      public_id: image.public_id,
      visibility: normalizeImageVisibility(image.visibility)
    }));

const splitProductImages = (images, imageVisibilityEnabled) => {
  const normalizedImages = parseImagesPayload(images);

  if (!imageVisibilityEnabled) {
    return {
      publicImages: normalizedImages.map(image => ({ ...image, visibility: 'public' })),
      internalImages: []
    };
  }

  return {
    publicImages: normalizedImages.filter(image => image.visibility !== 'internal'),
    internalImages: normalizedImages.filter(image => image.visibility === 'internal')
  };
};

const isStorefrontReadyProduct = (product, imageVisibilityEnabled = false) => {
  const storeVisibility = normalizeStoreVisibility(product?.storeVisibility);
  if (storeVisibility !== 'public') {
    return false;
  }

  const { publicImages } = splitProductImages(product?.images, imageVisibilityEnabled);
  return publicImages.length > 0;
};

const pushSaleHistoryEntry = (product, sale) => {
  if (!Array.isArray(product.saleHistory)) {
    product.saleHistory = [];
  }

  const quantity = Number(sale?.quantity || 0);
  const unitPrice = Number(sale?.unitPrice || 0);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return;
  }

  product.saleHistory.push({
    soldAt: sale?.soldAt || new Date(),
    color: normalizeVariantColor(sale?.color),
    size: normalizeVariantSize(sale?.size),
    quantity,
    unitPrice,
    total: Number((quantity * unitPrice).toFixed(2)),
    priceSource: sale?.priceSource === 'manual' ? 'manual' : 'retail'
  });
};

const buildProductSalesRecords = product => {
  const records = [];
  const trackedBySize = new Map();
  const history = Array.isArray(product?.saleHistory) ? product.saleHistory : [];

  history.forEach(entry => {
    const quantity = Number(entry?.quantity || 0);
    const unitPrice = Number(entry?.unitPrice || 0);
    const size = normalizeVariantSize(entry?.size);
    if (!quantity || !size || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return;
    }

    trackedBySize.set(size, Number(trackedBySize.get(size) || 0) + quantity);
    records.push({
      name: product.name,
      code: product.code,
      color: normalizeVariantColor(entry?.color),
      size,
      quantity,
      price: Number(unitPrice.toFixed(2)),
      total: Number((Number(entry?.total) || quantity * unitPrice).toFixed(2)),
      lastSoldAt: entry?.soldAt || product.lastSoldAt,
      priceSource: entry?.priceSource === 'manual' ? 'manual' : 'retail',
      isLegacy: false
    });
  });

  const priceRetail = Number(product?.price?.retail ?? 0);
  const soldBySize = ensureMap(product?.soldBySize);
  soldBySize.forEach((rawQuantity, rawSize) => {
    const size = normalizeVariantSize(rawSize);
    const soldQuantity = Number(rawQuantity || 0);
    const trackedQuantity = Number(trackedBySize.get(size) || 0);
    const remaining = soldQuantity - trackedQuantity;
    if (!size || remaining <= 0) {
      return;
    }

    records.push({
      name: product.name,
      code: product.code,
      color: DEFAULT_COLOR_LABEL,
      size,
      quantity: remaining,
      price: Number(priceRetail.toFixed(2)),
      total: Number((remaining * priceRetail).toFixed(2)),
      lastSoldAt: product.lastSoldAt,
      priceSource: 'retail',
      isLegacy: true
    });
  });

  return records;
};

const formatProduct = (product, options = {}) => {
  const {
    includeInternalImages = false,
    imageVisibilityEnabled = false
  } = options;
  const plain = product.toObject({ flattenMaps: true });
  const resolvedModel = normalizeString(plain.model) || normalizeString(plain.type);
  const price = plain.price || {};
  let variantMap = ensureMap(product.stockByColorSize);
  variantMap = new Map(variantMap);

  if (!variantMap.size) {
    const fallbackSizeMap = ensureMap(product.stockBySize);
    fallbackSizeMap.forEach((qty, sizeKey) => {
      variantMap.set(
        buildVariantKey(DEFAULT_COLOR_LABEL, sizeKey),
        Number(qty) || 0
      );
    });
  }

  const stockByColorSizePlain = mapSizes(variantMap);
  const aggregatedSizeMap = aggregateBySizeFromVariants(variantMap);
  const stockBySizePlain = mapSizes(aggregatedSizeMap);

  const soldVariantMap = ensureMap(product.soldByColorSize);
  const reservedVariantMap = ensureMap(product.reservedByColorSize);

  const soldByColorPlain = mapSizes(soldVariantMap);
  const reservedByColorPlain = mapSizes(reservedVariantMap);

  const soldBySizePlain = soldVariantMap.size
    ? mapSizes(aggregateBySizeFromVariants(soldVariantMap))
    : mapSizes(product.soldBySize);

  const reservedBySizePlain = reservedVariantMap.size
    ? mapSizes(aggregateBySizeFromVariants(reservedVariantMap))
    : mapSizes(product.reservedBySize);

  const colors = uniqueStrings([
    ...(Array.isArray(plain.colors) ? plain.colors : []),
    ...uniqueColorsFromVariantMap(variantMap)
  ]);

  const { publicImages, internalImages } = splitProductImages(
    plain.images,
    imageVisibilityEnabled
  );
  const storeVisibility = normalizeStoreVisibility(plain.storeVisibility);
  const storeReady = storeVisibility === 'public' && publicImages.length > 0;

  return {
    ...plain,
    model: resolvedModel,
    price: {
      retail: Number(price.retail ?? 0),
      gold: Number(price.gold ?? price.retail ?? 0),
      premium: Number(price.premium ?? price.retail ?? 0),
      platinum: Number(price.platinum ?? price.retail ?? 0)
    },
    colors,
    images: publicImages,
    internalImages: includeInternalImages ? internalImages : [],
    publicImageCount: publicImages.length,
    internalImageCount: internalImages.length,
    storeVisibility,
    storeReady,
    imageVisibilityEnabled: Boolean(imageVisibilityEnabled),
    stockBySize: stockBySizePlain,
    stockByColorSize: stockByColorSizePlain,
    soldBySize: soldBySizePlain,
    soldByColorSize: soldByColorPlain,
    reservedBySize: reservedBySizePlain,
    reservedByColorSize: reservedByColorPlain
  };
};

const getTotalStockQuantity = product => {
  const stockBySize = mapSizes(product?.stockBySize);
  return Object.values(stockBySize || {}).reduce((acc, qty) => acc + Number(qty || 0), 0);
};

const getImageVisibilityContext = async req => {
  const settings = await getSystemSettings();
  return {
    imageVisibilityEnabled: Boolean(settings?.enableInternalProductImages),
    includeInternalImages: isInternalUser(req.user)
  };
};

const getStorefrontVisibilityFilter = includeInternalImages =>
  includeInternalImages
    ? {}
    : {
        storeVisibility: 'public',
        images: {
          $elemMatch: {
            visibility: { $ne: 'internal' }
          }
        }
      };

router.post(
  '/upload-image',
  protect,
  adminOnly,
  requirePermission('products', 'upload'),
  upload.array('images', 10),
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No llegaron archivos' });
    }
    const images = req.files.map(file => ({
      url: file.path,
      public_id: file.filename,
      visibility: 'public'
    }));
    return res.status(200).json({ images });
  },
  (err, req, res, next) => {
    console.error('Error en upload-image:', err);
    return res
      .status(500)
      .json({ message: 'Error interno subiendo imagenes', error: err.message });
  }
);

router.get('/promocion', optionalProtect, async (req, res) => {
  try {
    const imageContext = await getImageVisibilityContext(req);
    const productosEnPromo = await Product.find({
      onSale: true,
      ...getStorefrontVisibilityFilter(imageContext.includeInternalImages)
    }).limit(6);
    res.json(productosEnPromo.map(product => formatProduct(product, imageContext)));
  } catch (error) {
    console.error('Error al obtener productos en promocion:', error);
    res.status(500).json({ message: 'Error al obtener productos en promocion' });
  }
});

router.get('/filters-options', async (req, res) => {
  try {
    const imageContext = await getImageVisibilityContext(req);
    const storefrontFilter = getStorefrontVisibilityFilter(imageContext.includeInternalImages);
    const brands = await Product.distinct('brand', storefrontFilter);
    const rawModels = await Product.find(storefrontFilter).select('model type');
    const models = uniqueStrings(
      rawModels.flatMap(product => [product.model, product.type])
    );
    const types = await Product.distinct('type', storefrontFilter);
    const genders = await Product.distinct('gender', storefrontFilter);
    const collections = await Product.distinct('collection', storefrontFilter);
    const min = await Product.find(storefrontFilter).sort({ 'price.retail': 1 }).limit(1);
    const max = await Product.find(storefrontFilter).sort({ 'price.retail': -1 }).limit(1);
    res.json({
      brands: uniqueStrings(brands),
      models,
      types: uniqueStrings(types),
      genders: uniqueStrings(genders),
      collections: uniqueStrings(collections),
      minPrice: min[0]?.price?.retail ?? 0,
      maxPrice: max[0]?.price?.retail ?? 0
    });
  } catch (error) {
    console.error('Error al obtener opciones de filtros:', error);
    res.status(500).json({ message: 'Error al obtener opciones de filtros' });
  }
});

router.get('/filtrar', optionalProtect, async (req, res) => {
  try {
    const imageContext = await getImageVisibilityContext(req);
    const {
      brand,
      model,
      type,
      gender,
      collection,
      size,
      onSale,
      minPrice,
      maxPrice
    } = req.query;

    const filter = {};
    applyRegexFilter(filter, 'brand', brand);
    applyModelFilter(filter, model);
    applyRegexFilter(filter, 'type', type);
    applyRegexFilter(filter, 'gender', gender);
    applyRegexFilter(filter, 'collection', collection);

    if (onSale === 'true') filter.onSale = true;
    if (onSale === 'false') filter.onSale = false;

    const sizeConditions = buildSizeConditions(size);
    if (sizeConditions.length) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: sizeConditions }
      ];
    }

    if (minPrice || maxPrice) {
      filter['price.retail'] = {};
      if (minPrice) filter['price.retail'].$gte = parseFloat(minPrice);
      if (maxPrice) filter['price.retail'].$lte = parseFloat(maxPrice);
    }

    // Dynamic attribute filters: any unknown query key
    const knownKeys = new Set(['brand','model','type','gender','collection','size','onSale','minPrice','maxPrice']);
    Object.entries(req.query).forEach(([key, value]) => {
      if (!knownKeys.has(key)) {
        applyRegexFilter(filter, `attributes.${key}`, value);
      }
    });

    const productos = await Product.find({
      ...filter,
      ...getStorefrontVisibilityFilter(imageContext.includeInternalImages)
    });
    res.json(productos.map(product => formatProduct(product, imageContext)));
  } catch (error) {
    console.error('Error al filtrar productos:', error);
    res.status(500).json({ message: 'Error al filtrar productos' });
  }
});

router.get('/filter', optionalProtect, async (req, res) => {
  try {
    const imageContext = await getImageVisibilityContext(req);
    const {
      brand,
      model,
      type,
      gender,
      collection,
      size,
      onSale,
      minPrice,
      maxPrice
    } = req.query;

    const filter = {};
    applyRegexFilter(filter, 'brand', brand);
    applyModelFilter(filter, model);
    applyRegexFilter(filter, 'type', type);
    applyRegexFilter(filter, 'gender', gender);
    applyRegexFilter(filter, 'collection', collection);

    if (onSale === 'true') filter.onSale = true;
    if (onSale === 'false') filter.onSale = false;

    const sizeConditions = buildSizeConditions(size);
    if (sizeConditions.length) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: sizeConditions }
      ];
    }

    if (minPrice || maxPrice) {
      filter['price.retail'] = {};
      if (minPrice) filter['price.retail'].$gte = parseFloat(minPrice);
      if (maxPrice) filter['price.retail'].$lte = parseFloat(maxPrice);
    }

    // Dynamic attribute filters: any unknown query key
    const knownKeys = new Set(['brand','model','type','gender','collection','size','onSale','minPrice','maxPrice']);
    Object.entries(req.query).forEach(([key, value]) => {
      if (!knownKeys.has(key)) {
        applyRegexFilter(filter, `attributes.${key}`, value);
      }
    });

    const productos = await Product.find({
      ...filter,
      ...getStorefrontVisibilityFilter(imageContext.includeInternalImages)
    });
    res.json(productos.map(product => formatProduct(product, imageContext)));
  } catch (error) {
    console.error('Error al filtrar productos:', error);
    res.status(500).json({ message: 'Error al filtrar productos' });
  }
});

router.get('/', optionalProtect, async (req, res) => {
  try {
    const imageContext = await getImageVisibilityContext(req);
    const products = await Product.find(
      getStorefrontVisibilityFilter(imageContext.includeInternalImages)
    );
    res.json(products.map(product => formatProduct(product, imageContext)));
  } catch {
    res.status(500).json({ message: 'Error al obtener productos' });
  }
});

router.get('/:id', optionalProtect, async (req, res) => {
  try {
    const imageContext = await getImageVisibilityContext(req);
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    const formatted = formatProduct(product, imageContext);
    if (!imageContext.includeInternalImages && !isStorefrontReadyProduct(product, imageContext.imageVisibilityEnabled)) {
      return res.status(404).json({ message: 'Producto no disponible en tienda' });
    }
    res.json(formatted);
  } catch {
    res.status(500).json({ message: 'Error al obtener producto' });
  }
});

  router.post('/', protect, adminOnly, requirePermission('products', 'create'), async (req, res) => {
    try {
      const settings = await getSystemSettings();
      const imageVisibilityEnabled = Boolean(settings?.enableInternalProductImages);
      const catalogProfile = String(settings?.catalogProfile || 'footwear');
      const payload = { ...req.body };
      payload.price = parsePricePayload(req.body.price);
      payload.model = normalizeString(req.body.model || (catalogProfile === 'footwear' ? req.body.type : ''));
      let stockByColorSizeMap = parseStockByColorSizePayload(
        req.body.stockByColorSize ?? req.body.variants
      );

    if (stockByColorSizeMap.size === 0 && req.body.stockBySize) {
      Object.entries(req.body.stockBySize || {}).forEach(([size, qty]) => {
        stockByColorSizeMap.set(
          buildVariantKey(DEFAULT_COLOR_LABEL, size),
          Number(qty) || 0
        );
      });
    }

      const aggregatedBySize = aggregateBySizeFromVariants(stockByColorSizeMap);

      const providedColors = parseColorsPayload(req.body.colors);
      const variantColors = uniqueColorsFromVariantMap(stockByColorSizeMap);
      payload.colors = uniqueStrings([...providedColors, ...variantColors]);
      // Normalize attributes map if provided
      if (req.body.attributes && typeof req.body.attributes === 'object') {
        payload.attributes = req.body.attributes;
      }
      payload.images = parseImagesPayload(req.body.images).map(image => ({
        ...image,
        visibility: imageVisibilityEnabled ? image.visibility : 'public'
      }));
      payload.storeVisibility = normalizeStoreVisibility(req.body.storeVisibility);
      payload.stockByColorSize = stockByColorSizeMap;
      payload.stockBySize = aggregatedBySize;

      const newProduct = new Product(payload);
      const saved = await newProduct.save();
      if (getTotalStockQuantity(saved) > 0) {
        await handleProductBackInStock(saved._id);
      }
    res.status(201).json(
      formatProduct(saved, {
        includeInternalImages: true,
        imageVisibilityEnabled
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Error al crear producto' });
  }
});

router.put('/:id', protect, adminOnly, requirePermission('products', 'edit'), async (req, res) => {
  try {
    const settings = await getSystemSettings();
    const imageVisibilityEnabled = Boolean(settings?.enableInternalProductImages);
    const catalogProfile = String(settings?.catalogProfile || 'footwear');
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    const previousStock = getTotalStockQuantity(product);

    if (req.body.price) {
      product.price = parsePricePayload(req.body.price);
    }

    if (req.body.model !== undefined) {
      product.model = normalizeString(req.body.model);
    } else if (catalogProfile === 'footwear' && req.body.type !== undefined && !normalizeString(product.model)) {
      product.model = normalizeString(req.body.type);
    }

    const incomingColors = req.body.colors !== undefined
      ? parseColorsPayload(req.body.colors)
      : null;

    const hasInventoryPayload =
      req.body.stockByColorSize !== undefined ||
      req.body.variants !== undefined ||
      req.body.stockBySize !== undefined;

    if (hasInventoryPayload) {
      let nextVariantMap = parseStockByColorSizePayload(
        req.body.stockByColorSize ?? req.body.variants
      );

      if (nextVariantMap.size === 0 && req.body.stockBySize) {
        Object.entries(req.body.stockBySize || {}).forEach(([size, qty]) => {
          nextVariantMap.set(
            buildVariantKey(DEFAULT_COLOR_LABEL, size),
            Number(qty) || 0
          );
        });
      }

      const aggregatedBySize = aggregateBySizeFromVariants(nextVariantMap);
      product.stockByColorSize = nextVariantMap;
      product.stockBySize = aggregatedBySize;

      const variantColors = uniqueColorsFromVariantMap(nextVariantMap);
      const mergedColors = incomingColors !== null
        ? uniqueStrings([...incomingColors, ...variantColors])
        : uniqueStrings([...(product.colors || []), ...variantColors]);
      product.colors = mergedColors;
    } else if (incomingColors !== null) {
      product.colors = incomingColors;
    }

    const fieldsToUpdate = ['name', 'code', 'description', 'brand', 'model', 'type', 'collection', 'gender', 'onSale', 'images', 'attributes', 'storeVisibility'];
    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = field === 'images'
          ? parseImagesPayload(req.body.images).map(image => ({
              ...image,
              visibility: imageVisibilityEnabled ? image.visibility : 'public'
            }))
          : field === 'storeVisibility'
            ? normalizeStoreVisibility(req.body.storeVisibility)
          : req.body[field];
      }
    });

    const incomingIds = (req.body.images || []).map(image => image.public_id);
    const toDelete = product.images
      .filter(img => !incomingIds.includes(img.public_id))
      .map(img => img.public_id);

    await Promise.all(toDelete.map(id => cloudinary.uploader.destroy(id)));
    const updated = await product.save();
    if (previousStock <= 0 && getTotalStockQuantity(updated) > 0) {
      await handleProductBackInStock(updated._id);
    }
    res.json(
      formatProduct(updated, {
        includeInternalImages: true,
        imageVisibilityEnabled
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Error al actualizar producto' });
  }
});

router.delete('/:id/image/*public_id', protect, adminOnly, requirePermission('products', 'edit'), async (req, res) => {
  const { id } = req.params;
  const publicId = Array.isArray(req.params.public_id)
    ? req.params.public_id.join('/')
    : req.params.public_id;
  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

    await cloudinary.uploader.destroy(publicId);
    product.images = product.images.filter(img => img.public_id !== publicId);
    await product.save();

    return res.json({ message: 'Imagen eliminada correctamente', images: product.images });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al eliminar imagen' });
  }
});

router.delete('/:id', protect, adminOnly, requirePermission('products', 'delete'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

    await Promise.all(product.images.map(img => cloudinary.uploader.destroy(img.public_id)));
    await product.deleteOne();
    res.json({ message: 'Producto e imagenes eliminados' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar producto' });
  }
});

router.post('/order/:id', protect, adminOnly, requireModuleEnabled('inventory'), requirePermission('inventory', 'adjust'), async (req, res) => {
  try {
    const { color, size, quantity } = req.body || {};
    const normalizedSize = normalizeVariantSize(size);
    const normalizedColor = normalizeVariantColor(color);
    const qty = Number(quantity);

    if (!normalizedSize || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Datos invalidos' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const stockByColorSize = ensureMap(product.stockByColorSize);
    const stockBySize = ensureMap(product.stockBySize);
    const reservedByColorSize = ensureMap(product.reservedByColorSize);
    const reservedBySize = ensureMap(product.reservedBySize);

    product.stockByColorSize = stockByColorSize;
    product.stockBySize = stockBySize;
    product.reservedByColorSize = reservedByColorSize;
    product.reservedBySize = reservedBySize;

    let chosenKey = buildVariantKey(normalizedColor, normalizedSize);
    let available = Number(stockByColorSize.get(chosenKey) ?? 0);

    if (available < qty) {
      const fallbackKey = buildVariantKey(DEFAULT_COLOR_LABEL, normalizedSize);
      if (fallbackKey !== chosenKey) {
        const fallbackAvailable = Number(stockByColorSize.get(fallbackKey) ?? 0);
        if (fallbackAvailable >= qty) {
          chosenKey = fallbackKey;
          available = fallbackAvailable;
        }
      }
    }

    const aggregatedAvailable = Number(stockBySize.get(normalizedSize) ?? 0);

    if (available < qty || aggregatedAvailable < qty) {
      return res.status(400).json({ message: 'Stock insuficiente o variante no encontrada' });
    }

    adjustMapValue(stockByColorSize, chosenKey, -qty);
    adjustMapValue(stockBySize, normalizedSize, -qty);
    adjustMapValue(reservedByColorSize, chosenKey, qty);
    adjustMapValue(reservedBySize, normalizedSize, qty);

    product.markModified('stockByColorSize');
    product.markModified('stockBySize');
    product.markModified('reservedByColorSize');
    product.markModified('reservedBySize');

    await product.save();
    res.json({ message: 'Pedido registrado con exito' });
  } catch (error) {
    console.error('Error en pedido:', error);
    res.status(500).json({ message: 'Error en pedido' });
  }
});

router.post('/sell/:id', protect, adminOnly, requireModuleEnabled('inventory'), requirePermission('inventory', 'adjust'), async (req, res) => {
  try {
    const { color, size, quantity, salePriceMode, manualSalePrice } = req.body || {};
    const normalizedSize = normalizeVariantSize(size);
    const normalizedColor = normalizeVariantColor(color);
    const qty = Number(quantity);
    const priceMode = salePriceMode === 'manual' ? 'manual' : 'retail';

    if (!normalizedSize || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Datos invalidos' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const resolvedRetailPrice = Number(product.price?.retail ?? 0);
    const resolvedManualSalePrice = Number(manualSalePrice);
    const unitSalePrice = priceMode === 'manual' ? resolvedManualSalePrice : resolvedRetailPrice;

    if (!Number.isFinite(unitSalePrice) || unitSalePrice < 0) {
      return res.status(400).json({ message: 'Precio de venta invalido' });
    }

    const stockByColorSize = ensureMap(product.stockByColorSize);
    const stockBySize = ensureMap(product.stockBySize);
    const soldByColorSize = ensureMap(product.soldByColorSize);
    const soldBySize = ensureMap(product.soldBySize);

    product.stockByColorSize = stockByColorSize;
    product.stockBySize = stockBySize;
    product.soldByColorSize = soldByColorSize;
    product.soldBySize = soldBySize;

    let chosenKey = buildVariantKey(normalizedColor, normalizedSize);
    let available = Number(stockByColorSize.get(chosenKey) ?? 0);

    if (available < qty) {
      const fallbackKey = buildVariantKey(DEFAULT_COLOR_LABEL, normalizedSize);
      if (fallbackKey !== chosenKey) {
        const fallbackAvailable = Number(stockByColorSize.get(fallbackKey) ?? 0);
        if (fallbackAvailable >= qty) {
          chosenKey = fallbackKey;
          available = fallbackAvailable;
        }
      }
    }

    const aggregatedAvailable = Number(stockBySize.get(normalizedSize) ?? 0);

    if (available < qty || aggregatedAvailable < qty) {
      return res.status(400).json({ message: 'Stock insuficiente o variante no encontrada' });
    }

    adjustMapValue(stockByColorSize, chosenKey, -qty);
    adjustMapValue(stockBySize, normalizedSize, -qty);
    adjustMapValue(soldByColorSize, chosenKey, qty);
    adjustMapValue(soldBySize, normalizedSize, qty);

    const soldAt = new Date();
    const { color: chosenColor } = splitVariantKey(chosenKey);
    pushSaleHistoryEntry(product, {
      soldAt,
      color: chosenColor,
      size: normalizedSize,
      quantity: qty,
      unitPrice: unitSalePrice,
      priceSource: priceMode
    });

    product.lastSoldAt = soldAt;
    product.markModified('stockByColorSize');
    product.markModified('stockBySize');
    product.markModified('soldByColorSize');
    product.markModified('soldBySize');
    product.markModified('saleHistory');

    await product.save();
    res.json({ message: 'Venta registrada con exito' });
  } catch (error) {
    console.error('Error en venta:', error);
    res.status(500).json({ message: 'Error en venta' });
  }
});

router.post('/confirm/:id', protect, adminOnly, requireModuleEnabled(['inventory', 'reports']), requirePermission('inventory', 'confirm'), async (req, res) => {
  try {
    const { color, size, quantity } = req.body || {};
    const normalizedSize = normalizeVariantSize(size);
    const normalizedColor = normalizeVariantColor(color);
    const qty = Number(quantity);

    if (!normalizedSize || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Datos invalidos' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const reservedByColorSize = ensureMap(product.reservedByColorSize);
    const reservedBySize = ensureMap(product.reservedBySize);
    const soldByColorSize = ensureMap(product.soldByColorSize);
    const soldBySize = ensureMap(product.soldBySize);

    product.reservedByColorSize = reservedByColorSize;
    product.reservedBySize = reservedBySize;
    product.soldByColorSize = soldByColorSize;
    product.soldBySize = soldBySize;

    let chosenKey = buildVariantKey(normalizedColor, normalizedSize);
    let reservedQty = Number(reservedByColorSize.get(chosenKey) ?? 0);

    if (reservedQty < qty) {
      const fallbackKey = buildVariantKey(DEFAULT_COLOR_LABEL, normalizedSize);
      if (fallbackKey !== chosenKey) {
        const fallbackReserved = Number(reservedByColorSize.get(fallbackKey) ?? 0);
        if (fallbackReserved >= qty) {
          chosenKey = fallbackKey;
          reservedQty = fallbackReserved;
        }
      }
    }

    if (reservedQty < qty) {
      return res.status(400).json({ message: 'Cantidad reservada insuficiente' });
    }

    adjustMapValue(reservedByColorSize, chosenKey, -qty);
    adjustMapValue(reservedBySize, normalizedSize, -qty);
    adjustMapValue(soldByColorSize, chosenKey, qty);
    adjustMapValue(soldBySize, normalizedSize, qty);

    const soldAt = new Date();
    const { color: chosenColor } = splitVariantKey(chosenKey);
    pushSaleHistoryEntry(product, {
      soldAt,
      color: chosenColor,
      size: normalizedSize,
      quantity: qty,
      unitPrice: Number(product.price?.retail ?? 0),
      priceSource: 'retail'
    });

    product.lastSoldAt = soldAt;
    product.markModified('reservedByColorSize');
    product.markModified('reservedBySize');
    product.markModified('soldByColorSize');
    product.markModified('soldBySize');
    product.markModified('saleHistory');

    await product.save();
    res.json({ message: 'Pedido confirmado y registrado como venta' });
  } catch (error) {
    console.error('Error al confirmar pedido:', error);
    res.status(500).json({ message: 'Error al confirmar pedido' });
  }
});
router.get('/summary/sales', protect, adminOnly, requireModuleEnabled('reports'), requirePermission('reports', 'view'), async (req, res) => {
  try {
    const products = await Product.find();
    const resumen = products.flatMap(prod => buildProductSalesRecords(prod));
    res.json(resumen);
  } catch {
    res.status(500).json({ message: 'Error al generar resumen' });
  }
});

router.post('/reset-sales', protect, adminOnly, requireModuleEnabled('reports'), requirePermission('reports', 'reset'), async (req, res) => {
  try {
    const products = await Product.find();
    for (const prod of products) {
      prod.soldBySize = new Map();
      prod.soldByColorSize = new Map();
      prod.saleHistory = [];
      prod.lastSoldAt = null;
      await prod.save();
    }
    res.json({ message: 'Historial de ventas reiniciado correctamente' });
  } catch {
    res.status(500).json({ message: 'Error al reiniciar ventas' });
  }
});

router.get('/analytics/overview', protect, adminOnly, requireModuleEnabled('reports'), requirePermission('reports', 'view'), async (req, res) => {
  try {
    const products = await Product.find();
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const dateBucket = {};
    let revenueToday = 0;
    let revenue7Days = 0;
    let totalRevenue = 0;
    let totalUnits = 0;

    const topProductsAccumulator = [];

    products.forEach(product => {
      const salesRecords = buildProductSalesRecords(product);
      if (!salesRecords.length) return;

      const unitsSold = salesRecords.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
      const revenue = salesRecords.reduce((acc, item) => acc + Number(item.total || 0), 0);
      const latestSaleAt = salesRecords.reduce((latest, item) => {
        const timestamp = item.lastSoldAt ? new Date(item.lastSoldAt).getTime() : 0;
        return timestamp > latest ? timestamp : latest;
      }, 0);

      totalRevenue += revenue;
      totalUnits += unitsSold;
      topProductsAccumulator.push({
        name: product.name,
        units: unitsSold,
        revenue,
        lastSoldAt: latestSaleAt ? new Date(latestSaleAt) : product.lastSoldAt
      });

      salesRecords.forEach(item => {
        if (!item.lastSoldAt) return;
        const soldDate = new Date(item.lastSoldAt);
        const dateKey = soldDate.toISOString().slice(0, 10);
        if (!dateBucket[dateKey]) {
          dateBucket[dateKey] = { units: 0, revenue: 0 };
        }
        dateBucket[dateKey].units += Number(item.quantity || 0);
        dateBucket[dateKey].revenue += Number(item.total || 0);

        if (soldDate.toDateString() === today.toDateString()) {
          revenueToday += Number(item.total || 0);
        }
        if (soldDate >= sevenDaysAgo) {
          revenue7Days += Number(item.total || 0);
        }
      });
    });

    const dailySeries = [];
    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      dailySeries.push({
        date: key,
        units: dateBucket[key]?.units ?? 0,
        revenue: Number((dateBucket[key]?.revenue ?? 0).toFixed(2))
      });
    }

    topProductsAccumulator.sort((a, b) => b.units - a.units);

    res.json({
      salesToday: Number(revenueToday.toFixed(2)),
      sales7Days: Number(revenue7Days.toFixed(2)),
      averageTicket: totalUnits > 0 ? Number((totalRevenue / totalUnits).toFixed(2)) : 0,
      topProducts: topProductsAccumulator.slice(0, 5).map(item => ({
        name: item.name,
        units: item.units,
        revenue: Number(item.revenue.toFixed(2)),
        lastSoldAt: item.lastSoldAt
      })),
      dailySeries
    });
  } catch (error) {
    console.error('Error al obtener analytics:', error);
    res.status(500).json({ message: 'Error al obtener analytics' });
  }
});

export default router;
