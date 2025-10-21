import Cart from '../models/Cart.js';
import Product from '../models/Product.js';

const DEFAULT_COLOR_LABEL = 'Sin color';

const normalizeVariantColor = color => {
  const trimmed = (color ?? '').toString().trim();
  return trimmed || DEFAULT_COLOR_LABEL;
};

const normalizeVariantSize = size =>
  (size ?? '').toString().trim().toUpperCase();

const buildVariantKey = (color, size) =>
  `${normalizeVariantColor(color)}::${normalizeVariantSize(size)}`;

const ensureMap = value => {
  if (!value) return new Map();
  if (value instanceof Map) return value;
  if (Array.isArray(value)) return new Map(value);
  if (typeof value === 'object') return new Map(Object.entries(value));
  return new Map();
};

const clampQuantity = quantity => Math.min(Math.max(quantity, 1), 99);

const resolvePriceForMembership = (product, membershipLevel = 'STANDARD') => {
  const normalized = membershipLevel.toUpperCase();
  const price = product.price || {};
  switch (normalized) {
    case 'GOLD':
      return price.gold ?? price.retail ?? 0;
    case 'PREMIUM':
      return price.premium ?? price.retail ?? 0;
    case 'PLATINUM':
      return price.platinum ?? price.retail ?? 0;
    default:
      return price.retail ?? 0;
  }
};

const normalizeItems = items => {
  const clamped = items.map(rawItem => {
    const base =
      typeof rawItem.toObject === 'function'
        ? rawItem.toObject({ getters: true, virtuals: false })
        : rawItem;

    return {
      ...base,
      product: base.product?.toString?.() || base.product,
      quantity: clampQuantity(base.quantity),
      color: base.color || ''
    };
  });

  const totals = clamped.reduce(
    (acc, item) => {
      acc.count += item.quantity;
      acc.items += 1;
      acc.subtotal += item.quantity * item.unitPrice;
      return acc;
    },
    { count: 0, items: 0, subtotal: 0 }
  );

  return {
    items: clamped,
    totals: {
      ...totals,
      subtotal: Number(totals.subtotal.toFixed(2))
    }
  };
};

const getOrCreateCart = async userId => {
  const existing = await Cart.findOne({ user: userId });
  if (existing) return existing;
  return Cart.create({ user: userId, items: [] });
};

export const getCart = async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const payload = normalizeItems(cart.items);
  res.json(payload);
};

export const addItemToCart = async (req, res) => {
  const { productId, size = '', quantity = 1, color = '' } = req.body;

  if (!productId) {
    return res.status(400).json({ message: 'productId is required' });
  }

  const product = await Product.findById(productId).lean();
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const desiredQty = clampQuantity(Number(quantity) || 1);
  const stockMap = product.stockBySize instanceof Map
    ? Object.fromEntries(product.stockBySize)
    : product.stockBySize || {};
  const normalizedColor = normalizeVariantColor(color);
  const normalizedSize = normalizeVariantSize(size);

  if (size) {
    const aggregatedAvailable = Number(stockMap?.[normalizedSize] || 0);
    if (aggregatedAvailable <= 0) {
      return res.status(400).json({ message: 'Selected size is out of stock' });
    }

    let variantAvailable = aggregatedAvailable;
    const variantMap = ensureMap(product.stockByColorSize);
    if (variantMap.size) {
      let variantKey = buildVariantKey(normalizedColor, normalizedSize);
      variantAvailable = Number(variantMap.get(variantKey) ?? 0);
      if (variantAvailable <= 0) {
        const fallbackKey = buildVariantKey(DEFAULT_COLOR_LABEL, normalizedSize);
        if (fallbackKey !== variantKey) {
          variantAvailable = Number(variantMap.get(fallbackKey) ?? 0);
        }
      }
    }

    if (variantAvailable <= 0) {
      return res.status(400).json({ message: 'Selected color and size are out of stock' });
    }
    if (desiredQty > variantAvailable) {
      return res.status(400).json({ message: 'Requested quantity exceeds stock' });
    }
  }

  const cart = await getOrCreateCart(req.user._id);
  const unitPrice = resolvePriceForMembership(product, req.user.membershipLevel);
  const existing = cart.items.find(
    item =>
      item.product.toString() === product._id.toString() &&
      item.size === normalizedSize &&
      normalizeVariantColor(item.color) === normalizedColor
  );

  if (existing) {
    const nextQty = clampQuantity(existing.quantity + desiredQty);
    existing.quantity = nextQty;
    existing.unitPrice = unitPrice;
  } else {
    cart.items.push({
      product: product._id,
      size: normalizedSize,
      quantity: desiredQty,
      unitPrice,
      title: product.name,
      imageUrl: product.images?.[0]?.url || '',
      color: normalizedColor
    });
  }

  await cart.save();
  const payload = normalizeItems(cart.items);
  res.status(201).json(payload);
};

export const updateCartItem = async (req, res) => {
  const { productId } = req.params;
  const { size = '', quantity, color = '' } = req.body;
  const normalizedSize = normalizeVariantSize(size);

  if (!productId) {
    return res.status(400).json({ message: 'productId param required' });
  }

  const cart = await getOrCreateCart(req.user._id);
  const normalizedColor = normalizeVariantColor(color);
  const item = cart.items.find(
    entry =>
      entry.product.toString() === productId &&
      entry.size === normalizedSize &&
      normalizeVariantColor(entry.color) === normalizedColor
  );

  if (!item) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  if (quantity == null) {
    return res.status(400).json({ message: 'quantity is required' });
  }

  const nextQty = clampQuantity(Number(quantity));
  if (nextQty <= 0) {
    cart.items = cart.items.filter(
      entry =>
        !(
          entry.product.toString() === productId &&
          entry.size === normalizedSize &&
          normalizeVariantColor(entry.color) === normalizedColor
        )
    );
  } else {
    item.quantity = nextQty;
  }

  await cart.save();
  const payload = normalizeItems(cart.items);
  res.json(payload);
};

export const removeCartItem = async (req, res) => {
  const { productId } = req.params;
  const { size = '', color = '' } = req.body || {};
  const normalizedSize = normalizeVariantSize(size);

  const cart = await getOrCreateCart(req.user._id);
  const normalizedColor = normalizeVariantColor(color);
  const nextItems = cart.items.filter(
    entry =>
      !(
        entry.product.toString() === productId &&
        entry.size === normalizedSize &&
        normalizeVariantColor(entry.color) === normalizedColor
      )
  );

  if (nextItems.length === cart.items.length) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  cart.items = nextItems;
  await cart.save();

  const payload = normalizeItems(cart.items);
  res.json(payload);
};

export const clearCart = async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();

  res.json(normalizeItems(cart.items));
};

export const mergeCart = async (req, res) => {
  const { guestItems } = req.body || {};
  const cart = await getOrCreateCart(req.user._id);

  if (!Array.isArray(guestItems) || guestItems.length === 0) {
    return res.json({ ...normalizeItems(cart.items), source: 'unchanged' });
  }

  for (const guestItem of guestItems) {
    if (!guestItem?.productId) continue;

    const product = await Product.findById(guestItem.productId).lean();
    if (!product) continue;

    const normalizedSize = normalizeVariantSize(guestItem.size || '');
    const normalizedColor = normalizeVariantColor(guestItem.color);
    const desiredQty = clampQuantity(Number(guestItem.quantity) || 1);
    const unitPrice = resolvePriceForMembership(product, req.user.membershipLevel);

    const existing = cart.items.find(
      entry =>
        entry.product.toString() === product._id.toString() &&
        entry.size === normalizedSize &&
        normalizeVariantColor(entry.color) === normalizedColor
    );

    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + desiredQty);
      existing.unitPrice = unitPrice;
    } else {
      cart.items.push({
        product: product._id,
        size: normalizedSize,
        quantity: desiredQty,
        unitPrice,
        title: product.name,
        imageUrl: product.images?.[0]?.url || '',
        color: normalizedColor
      });
    }
  }

  await cart.save();
  res.json({ ...normalizeItems(cart.items), source: 'merged' });
};

