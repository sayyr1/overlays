import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

const MEMBERSHIP_PRICE_KEY = {
  STANDARD: 'retail',
  GOLD: 'gold',
  PREMIUM: 'premium',
  PLATINUM: 'platinum'
};

export const ORDER_STATUSES = Object.freeze({
  PENDING: 'PENDIENTE_PAGO',
  PAID: 'PAGADO',
  PROCESSING: 'EN_PREPARACION',
  SHIPPED: 'ENVIADO',
  DELIVERED: 'ENTREGADO',
  CANCELLED: 'CANCELADO',
  EXPIRED: 'EXPIRADO'
});

const VALID_ORDER_STATUSES = Object.values(ORDER_STATUSES);

const STATUS_TRANSITIONS = {
  [ORDER_STATUSES.PAID]: [ORDER_STATUSES.PROCESSING, ORDER_STATUSES.SHIPPED, ORDER_STATUSES.DELIVERED],
  [ORDER_STATUSES.PROCESSING]: [ORDER_STATUSES.SHIPPED, ORDER_STATUSES.DELIVERED],
  [ORDER_STATUSES.SHIPPED]: [ORDER_STATUSES.DELIVERED]
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

const adjustMapValue = (map, key, delta) => {
  if (!(map instanceof Map)) return;
  const current = toNumber(map.get(key));
  const next = current + delta;
  if (next <= 0) {
    map.delete(key);
  } else {
    map.set(key, next);
  }
};

const toNumber = value => Number(value || 0);

const getPriceForMembership = (product, membershipLevel = 'STANDARD') => {
  const key = MEMBERSHIP_PRICE_KEY[membershipLevel?.toUpperCase?.()] || 'retail';
  const price = product.price || {};
  return toNumber(price[key] ?? price.retail ?? 0);
};

const ensureMap = value => {
  if (!value) return new Map();
  if (value instanceof Map) return value;
  if (Array.isArray(value)) return new Map(value);
  if (typeof value === 'object') return new Map(Object.entries(value));
  return new Map();
};

const ensureProductMapsInitialized = product => {
  product.stockByColorSize = ensureMap(product.stockByColorSize);
  product.reservedByColorSize = ensureMap(product.reservedByColorSize);
  product.soldByColorSize = ensureMap(product.soldByColorSize);
  product.stockBySize = ensureMap(product.stockBySize);
  product.reservedBySize = ensureMap(product.reservedBySize);
  product.soldBySize = ensureMap(product.soldBySize);
};

const reserveStockForItem = (product, color, size, quantity) => {
  ensureProductMapsInitialized(product);

  const normalizedColor = normalizeVariantColor(color);
  const normalizedSize = normalizeVariantSize(size);
  let variantKey = buildVariantKey(normalizedColor, normalizedSize);
  let available = toNumber(product.stockByColorSize.get(variantKey));

  if (available < quantity) {
    const fallbackKey = buildVariantKey(DEFAULT_COLOR_LABEL, normalizedSize);
    const fallbackAvailable = toNumber(product.stockByColorSize.get(fallbackKey));
    if (fallbackAvailable >= quantity) {
      variantKey = fallbackKey;
      available = fallbackAvailable;
    } else {
      const aggregatedAvailable = toNumber(product.stockBySize.get(normalizedSize));
      if (aggregatedAvailable < quantity) {
        throw new Error('Stock insuficiente para el producto');
      }
      variantKey = fallbackKey;
      available = aggregatedAvailable;
    }
  }

  product.stockByColorSize.set(variantKey, available - quantity);
  adjustMapValue(product.stockBySize, normalizedSize, -quantity);
  adjustMapValue(product.reservedByColorSize, variantKey, quantity);
  adjustMapValue(product.reservedBySize, normalizedSize, quantity);

  product.markModified('stockByColorSize');
  product.markModified('reservedByColorSize');
  product.markModified('stockBySize');
  product.markModified('reservedBySize');

  return splitVariantKey(variantKey).color;
};

const releaseReservedStock = (product, color, size, quantity) => {
  ensureProductMapsInitialized(product);

  const normalizedColor = normalizeVariantColor(color);
  const normalizedSize = normalizeVariantSize(size);
  const variantKey = buildVariantKey(normalizedColor, normalizedSize);
  const reserved = toNumber(product.reservedByColorSize.get(variantKey));
  if (reserved < quantity) {
    throw new Error('Cantidad reservada insuficiente');
  }

  adjustMapValue(product.reservedByColorSize, variantKey, -quantity);
  adjustMapValue(product.reservedBySize, normalizedSize, -quantity);

  const available = toNumber(product.stockByColorSize.get(variantKey));
  product.stockByColorSize.set(variantKey, available + quantity);
  adjustMapValue(product.stockBySize, normalizedSize, quantity);

  product.markModified('stockByColorSize');
  product.markModified('reservedByColorSize');
  product.markModified('stockBySize');
  product.markModified('reservedBySize');
};

const finalizeReservedStock = (product, color, size, quantity) => {
  ensureProductMapsInitialized(product);

  const normalizedColor = normalizeVariantColor(color);
  const normalizedSize = normalizeVariantSize(size);
  const variantKey = buildVariantKey(normalizedColor, normalizedSize);
  const reserved = toNumber(product.reservedByColorSize.get(variantKey));
  if (reserved < quantity) {
    throw new Error('No hay reserva suficiente para confirmar la venta');
  }

  adjustMapValue(product.reservedByColorSize, variantKey, -quantity);
  adjustMapValue(product.reservedBySize, normalizedSize, -quantity);
  adjustMapValue(product.soldByColorSize, variantKey, quantity);
  adjustMapValue(product.soldBySize, normalizedSize, quantity);

  product.lastSoldAt = new Date();
  product.markModified('reservedByColorSize');
  product.markModified('reservedBySize');
  product.markModified('soldByColorSize');
  product.markModified('soldBySize');
};

const expirePendingOrders = async () => {
  const now = new Date();
  const expiredOrders = await Order.find({
    status: ORDER_STATUSES.PENDING,
    expiresAt: { $lte: now }
  });

  if (!expiredOrders.length) {
    return;
  }

  for (const order of expiredOrders) {
    const productCache = new Map();
    for (const item of order.items) {
      const productId = item.product.toString();
      if (!productCache.has(productId)) {
        const product = await Product.findById(productId);
        if (!product) {
          continue;
        }
        productCache.set(productId, product);
      }
      const product = productCache.get(productId);
      releaseReservedStock(product, item.color, item.size, item.quantity);
    }

    for (const product of productCache.values()) {
      await product.save();
    }

    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: ORDER_STATUSES.EXPIRED,
      note: 'Cancelado automaticamente por expiracion',
      changedAt: now,
      changedBy: null
    });
    order.status = ORDER_STATUSES.EXPIRED;
    order.cancelledAt = now;
    order.cancelledBy = null;
    await order.save();
  }
};

export const createOrder = async (req, res) => {
  const {
    items,
    contactName = '',
    contactPhone = '',
    contactEmail = '',
    contactAddress = '',
    notes = '',
    totals = {}
  } = req.body || {};

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Debes enviar productos en el pedido' });
  }

  const membershipLevel = req.user?.membershipLevel || 'STANDARD';
  const productCache = new Map();
  const processedItems = [];
  const touchedProducts = new Set();
  const now = new Date();

  try {
    for (const item of items) {
      const productId = item.productId || item.product;
      const size = item.size || '';
      const color = item.color?.trim?.() || '';
      const quantity = Number(item.quantity || 0);

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error('Producto invalido');
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Cantidad invalida');
      }

      if (!productCache.has(productId)) {
        const productDoc = await Product.findById(productId);
        if (!productDoc) {
          throw new Error('Producto no encontrado');
        }
        productCache.set(productId, productDoc);
      }

      const product = productCache.get(productId);
      const effectiveColor = reserveStockForItem(product, color, size, quantity);
      touchedProducts.add(productId);

      const unitPrice = getPriceForMembership(product, membershipLevel);
      processedItems.push({
        product,
        size,
        color: effectiveColor,
        quantity,
        orderItem: {
          product: product._id,
          size,
          color: effectiveColor,
          quantity,
          unitPrice,
          title: product.name,
          imageUrl: product.images?.[0]?.url || ''
        }
      });
    }

    for (const productId of touchedProducts) {
      const product = productCache.get(productId);
      await product.save();
    }

    const subtotal = processedItems.reduce(
      (acc, item) => acc + item.orderItem.unitPrice * item.orderItem.quantity,
      0
    );

    const quantityTotal = processedItems.reduce(
      (acc, item) => acc + item.orderItem.quantity,
      0
    );

    const requestedTotal = Number(totals?.total ?? totals?.subtotal ?? subtotal);
    const finalTotal = Number.isFinite(requestedTotal) && requestedTotal >= 0
      ? requestedTotal
      : subtotal;

    const order = new Order({
      user: req.user?._id ?? null,
      items: processedItems.map(item => item.orderItem),
      subtotal,
      total: finalTotal,
      totals: {
        subtotal,
        count: quantityTotal,
        items: processedItems.length
      },
      status: ORDER_STATUSES.PENDING,
      contactName,
      contactPhone,
      contactEmail,
      contactAddress,
      notes,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      statusHistory: [{
        status: ORDER_STATUSES.PENDING,
        note: notes,
        changedAt: now,
        changedBy: req.user?._id ?? null
      }]
    });

    await order.save();

    return res.status(201).json({
      orderId: order.orderNumber,
      id: order._id,
      status: order.status,
      total: order.total,
      totals: order.totals,
      expiresAt: order.expiresAt
    });
  } catch (error) {
    for (const item of processedItems) {
      try {
        releaseReservedStock(item.product, item.color, item.size, item.quantity);
      } catch (rollbackError) {
        console.error('Error revertiendo reserva', rollbackError);
      }
    }

    for (const productId of touchedProducts) {
      try {
        const product = productCache.get(productId);
        await product.save();
      } catch (saveError) {
        console.error('Error guardando producto tras revertir', saveError);
      }
    }

    return res.status(400).json({ message: error.message || 'No se pudo crear el pedido' });
  }
};

const appendProductDetails = async orders => {
  const productIds = new Set();
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      if (item.product) {
        const id = typeof item.product === 'object' && item.product !== null && item.product._id
          ? item.product._id
          : item.product;
        if (id) {
          productIds.add(id.toString());
        }
      }
    });
  });

  if (!productIds.size) {
    return orders;
  }

  const products = await Product.find({ _id: { $in: Array.from(productIds) } })
    .select('name brand type collection gender code')
    .lean();

  const productMap = new Map(products.map(product => [product._id.toString(), product]));

  return orders.map(order => ({
    ...order,
    items: (order.items || []).map(item => {
      const key =
        typeof item.product === 'object' && item.product !== null && item.product._id
          ? item.product._id.toString()
          : item.product?.toString?.();
      const productDetails = key ? productMap.get(key) || null : null;
      return {
        ...item,
        productDetails
      };
    })
  }));
};

export const getOrders = async (req, res) => {
  await expirePendingOrders();
  const ordersRaw = await Order.find()
    .populate('user', 'name email membershipLevel')
    .populate('confirmedBy', 'name email')
    .populate('cancelledBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const orders = await appendProductDetails(ordersRaw);
  return res.json(orders);
};

export const getOwnOrders = async (req, res) => {
  await expirePendingOrders();
  const ordersRaw = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .lean();
  const orders = await appendProductDetails(ordersRaw);
  return res.json(orders);
};

export const confirmOrder = async (req, res) => {
  const { id } = req.params;
  const { note = '', paymentReference = '' } = req.body || {};

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: 'Pedido no encontrado' });
  }
  if (order.status !== ORDER_STATUSES.PENDING) {
    return res.status(400).json({ message: 'El pedido no esta pendiente de pago' });
  }

  const productCache = new Map();

  try {
    for (const item of order.items) {
      const productId = item.product.toString();
      if (!productCache.has(productId)) {
        const product = await Product.findById(productId);
        if (!product) {
          throw new Error('Producto no encontrado durante la confirmacion');
        }
        productCache.set(productId, product);
      }
      const product = productCache.get(productId);
      finalizeReservedStock(product, item.color, item.size, item.quantity);
    }

    for (const product of productCache.values()) {
      await product.save();
    }

    const now = new Date();
    order.status = ORDER_STATUSES.PAID;
    order.confirmedAt = now;
    order.confirmedBy = req.user?._id ?? null;
    if (paymentReference) {
      order.paymentReference = paymentReference;
    }
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: ORDER_STATUSES.PAID,
      note,
      changedAt: now,
      changedBy: req.user?._id ?? null
    });

    await order.save();

    const populated = await Order.findById(id)
      .populate('user', 'name email membershipLevel')
      .populate('confirmedBy', 'name email');

    return res.json(populated);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'No se pudo confirmar el pedido' });
  }
};

export const cancelOrder = async (req, res) => {
  const { id } = req.params;
  const { note = '' } = req.body || {};

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: 'Pedido no encontrado' });
  }
  if (order.status !== ORDER_STATUSES.PENDING) {
    return res.status(400).json({ message: 'Solo se pueden cancelar pedidos pendientes' });
  }

  const productCache = new Map();

  for (const item of order.items) {
    const productId = item.product.toString();
    if (!productCache.has(productId)) {
      const product = await Product.findById(productId);
      if (!product) {
        continue;
      }
      productCache.set(productId, product);
    }
    const product = productCache.get(productId);
    releaseReservedStock(product, item.color, item.size, item.quantity);
  }

  for (const product of productCache.values()) {
    await product.save();
  }

  const now = new Date();
  order.status = ORDER_STATUSES.CANCELLED;
  order.cancelledAt = now;
  order.cancelledBy = req.user?._id ?? null;
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({
    status: ORDER_STATUSES.CANCELLED,
    note,
    changedAt: now,
    changedBy: req.user?._id ?? null
  });

  await order.save();

  const populated = await Order.findById(id)
    .populate('user', 'name email membershipLevel')
    .populate('cancelledBy', 'name email');

  return res.json(populated);
};

export const clearOrderHistory = async (req, res) => {
  // Borra todos los pedidos. Para los pedidos pendientes, libera las reservas antes de borrar.
  const orders = await Order.find({});
  const touched = new Set();
  const productCache = new Map();

  for (const order of orders) {
    if (order.status !== ORDER_STATUSES.PENDING) continue;
    for (const item of order.items || []) {
      const productId = item.product?.toString?.();
      if (!productId) continue;
      if (!productCache.has(productId)) {
        const product = await Product.findById(productId);
        if (!product) continue;
        productCache.set(productId, product);
      }
      const product = productCache.get(productId);
      try {
        releaseReservedStock(product, item.color, item.size, item.quantity);
        touched.add(productId);
      } catch (e) {
        // continuar liberando el resto
      }
    }
  }

  for (const productId of touched) {
    try {
      const product = productCache.get(productId);
      await product.save();
    } catch (e) {
      // noop
    }
  }

  const toDelete = orders.length;
  await Order.deleteMany({});
  return res.json({ deleted: toDelete });
};

export const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, note = '' } = req.body || {};

  if (!status || !VALID_ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Estado invalido' });
  }

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: 'Pedido no encontrado' });
  }

  if (order.status === status) {
    const populated = await Order.findById(id)
      .populate('user', 'name email membershipLevel')
      .populate('confirmedBy', 'name email')
      .populate('cancelledBy', 'name email');
    return res.json(populated);
  }

  const restrictedStatuses = [
    ORDER_STATUSES.PENDING,
    ORDER_STATUSES.PAID,
    ORDER_STATUSES.CANCELLED,
    ORDER_STATUSES.EXPIRED
  ];
  if (restrictedStatuses.includes(status)) {
    return res.status(400).json({ message: 'El estado solicitado debe gestionarse desde otra accion' });
  }

  const allowed = STATUS_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({
      message: `No es posible cambiar de ${order.status} a ${status}`
    });
  }

  const now = new Date();
  order.status = status;

  if (status === ORDER_STATUSES.PROCESSING && !order.processingAt) {
    order.processingAt = now;
  }
  if (status === ORDER_STATUSES.SHIPPED) {
    order.shippedAt = now;
  }
  if (status === ORDER_STATUSES.DELIVERED) {
    order.deliveredAt = now;
  }

  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({
    status,
    note,
    changedAt: now,
    changedBy: req.user?._id ?? null
  });

  await order.save();

  const populated = await Order.findById(id)
    .populate('user', 'name email membershipLevel')
    .populate('confirmedBy', 'name email')
    .populate('cancelledBy', 'name email');

  return res.json(populated);
};
