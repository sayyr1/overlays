import express from 'express';
import Product from '../models/Product.js';
import upload from '../middleware/upload.js';
import cloudinary from '../utils/cloudinary.js';
import { protect, adminOnly, requirePermission } from '../middleware/authMiddleware.js';
import { requireModuleEnabled } from '../middleware/moduleMiddleware.js';
import { handleProductBackInStock } from '../services/crmAutomationService.js';

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
    throw new Error('Precios invÃ¡lidos');
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

const formatProduct = product => {
  const plain = product.toObject();
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

  return {
    ...plain,
    price: {
      retail: Number(price.retail ?? 0),
      gold: Number(price.gold ?? price.retail ?? 0),
      premium: Number(price.premium ?? price.retail ?? 0),
      platinum: Number(price.platinum ?? price.retail ?? 0)
    },
    colors,
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
      public_id: file.filename
    }));
    return res.status(200).json({ images });
  },
  (err, req, res, next) => {
    console.error('Error en upload-image:', err);
    return res
      .status(500)
      .json({ message: 'Error interno subiendo imÃ¡genes', error: err.message });
  }
);

router.get('/promocion', async (req, res) => {
  try {
    const productosEnPromo = await Product.find({ onSale: true }).limit(6);
    res.json(productosEnPromo.map(formatProduct));
  } catch (error) {
    console.error('Error al obtener productos en promociÃ³n:', error);
    res.status(500).json({ message: 'Error al obtener productos en promociÃ³n' });
  }
});

router.get('/filters-options', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    const types = await Product.distinct('type');
    const genders = await Product.distinct('gender');
    const collections = await Product.distinct('collection');
    const min = await Product.find().sort({ 'price.retail': 1 }).limit(1);
    const max = await Product.find().sort({ 'price.retail': -1 }).limit(1);
    res.json({
      brands: uniqueStrings(brands),
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

router.get('/filtrar', async (req, res) => {
  try {
    const {
      brand,
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
    const knownKeys = new Set(['brand','type','gender','collection','size','onSale','minPrice','maxPrice']);
    Object.entries(req.query).forEach(([key, value]) => {
      if (!knownKeys.has(key)) {
        applyRegexFilter(filter, `attributes.${key}`, value);
      }
    });

    const productos = await Product.find(filter);
    res.json(productos.map(formatProduct));
  } catch (error) {
    console.error('Error al filtrar productos:', error);
    res.status(500).json({ message: 'Error al filtrar productos' });
  }
});

router.get('/filter', async (req, res) => {
  try {
    const {
      brand,
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
    const knownKeys = new Set(['brand','type','gender','collection','size','onSale','minPrice','maxPrice']);
    Object.entries(req.query).forEach(([key, value]) => {
      if (!knownKeys.has(key)) {
        applyRegexFilter(filter, `attributes.${key}`, value);
      }
    });

    const productos = await Product.find(filter);
    res.json(productos.map(formatProduct));
  } catch (error) {
    console.error('Error al filtrar productos:', error);
    res.status(500).json({ message: 'Error al filtrar productos' });
  }
});

router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products.map(formatProduct));
  } catch {
    res.status(500).json({ message: 'Error al obtener productos' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json(formatProduct(product));
  } catch {
    res.status(500).json({ message: 'Error al obtener producto' });
  }
});

  router.post('/', protect, adminOnly, requirePermission('products', 'create'), async (req, res) => {
    try {
      const payload = { ...req.body };
      payload.price = parsePricePayload(req.body.price);
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
      payload.stockByColorSize = stockByColorSizeMap;
      payload.stockBySize = aggregatedBySize;

      const newProduct = new Product(payload);
      const saved = await newProduct.save();
      if (getTotalStockQuantity(saved) > 0) {
        await handleProductBackInStock(saved._id);
      }
    res.status(201).json(formatProduct(saved));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Error al crear producto' });
  }
});

router.put('/:id', protect, adminOnly, requirePermission('products', 'edit'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    const previousStock = getTotalStockQuantity(product);

    if (req.body.price) {
      product.price = parsePricePayload(req.body.price);
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

    const fieldsToUpdate = ['name', 'code', 'description', 'brand', 'type', 'collection', 'gender', 'onSale', 'images', 'attributes'];
    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
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
    res.json(formatProduct(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Error al actualizar producto' });
  }
});

router.delete('/:id/image/:public_id(*)', protect, adminOnly, requirePermission('products', 'edit'), async (req, res) => {
  const { id, public_id } = req.params;
  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

    await cloudinary.uploader.destroy(public_id);
    product.images = product.images.filter(img => img.public_id !== public_id);
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
    res.json({ message: 'Producto e imÃ¡genes eliminados' });
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

    product.lastSoldAt = new Date();
    product.markModified('stockByColorSize');
    product.markModified('stockBySize');
    product.markModified('soldByColorSize');
    product.markModified('soldBySize');

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

    product.lastSoldAt = new Date();
    product.markModified('reservedByColorSize');
    product.markModified('reservedBySize');
    product.markModified('soldByColorSize');
    product.markModified('soldBySize');

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
    const resumen = [];
    products.forEach(prod => {
      for (const [size, quantity] of prod.soldBySize.entries()) {
        const priceRetail = parseFloat(prod.price?.retail ?? 0);
        resumen.push({
          name: prod.name,
          code: prod.code,
          size,
          quantity,
          price: priceRetail.toFixed(2),
          total: (priceRetail * quantity).toFixed(2),
          lastSoldAt: prod.lastSoldAt
        });
      }
    });
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
      const priceRetail = Number(product.price?.retail ?? 0);
      let unitsSold = 0;
      for (const quantity of product.soldBySize.values()) {
        unitsSold += quantity;
      }
      if (unitsSold === 0) return;

      const revenue = unitsSold * priceRetail;
      totalRevenue += revenue;
      totalUnits += unitsSold;
      topProductsAccumulator.push({
        name: product.name,
        units: unitsSold,
        revenue,
        lastSoldAt: product.lastSoldAt
      });

      if (product.lastSoldAt) {
        const soldDate = new Date(product.lastSoldAt);
        const dateKey = soldDate.toISOString().slice(0, 10);
        if (!dateBucket[dateKey]) {
          dateBucket[dateKey] = { units: 0, revenue: 0 };
        }
        dateBucket[dateKey].units += unitsSold;
        dateBucket[dateKey].revenue += revenue;

        if (soldDate.toDateString() === today.toDateString()) {
          revenueToday += revenue;
        }
        if (soldDate >= sevenDaysAgo) {
          revenue7Days += revenue;
        }
      }
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

