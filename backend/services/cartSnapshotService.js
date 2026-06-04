import CartSnapshot from '../models/CartSnapshot.js';
import { buildSuggestedMessage } from './crmMessageService.js';

const normalizeItems = items =>
  (Array.isArray(items) ? items : []).map(item => ({
    product: item.productId || item.product,
    title: item.title || '',
    size: item.size || '',
    color: item.color || '',
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
    imageUrl: item.imageUrl || ''
  }));

const computeTotals = items => {
  const normalized = normalizeItems(items);
  return normalized.reduce(
    (acc, item) => {
      acc.subtotal += Number(item.unitPrice || 0) * Number(item.quantity || 0);
      acc.itemsCount += 1;
      acc.quantityCount += Number(item.quantity || 0);
      return acc;
    },
    { items: normalized, subtotal: 0, itemsCount: 0, quantityCount: 0 }
  );
};

export const upsertCartSnapshot = async ({
  session = null,
  sessionId = '',
  contactId = null,
  userId = null,
  items = [],
  status = 'active',
  source = '',
  medium = '',
  campaign = '',
  contactName = '',
  contactPhone = '',
  contactEmail = ''
}) => {
  const query = sessionId ? { sessionId, status: { $in: ['active', 'checkout_started', 'abandoned', 'contacted'] } } : { _id: null };
  let snapshot = await CartSnapshot.findOne(query).sort({ updatedAt: -1 });
  const now = new Date();
  const totals = computeTotals(items);

  if (!snapshot) {
    snapshot = new CartSnapshot({
      session: session?._id || null,
      sessionId: sessionId || session?.sessionId || '',
      contact: contactId,
      user: userId,
      items: totals.items,
      subtotal: Number(totals.subtotal.toFixed(2)),
      itemsCount: totals.itemsCount,
      quantityCount: totals.quantityCount,
      status,
      source,
      medium,
      campaign,
      contactName,
      contactPhone,
      contactEmail,
      lastActivityAt: now,
      checkoutStartedAt: status === 'checkout_started' ? now : null,
      suggestedMessage: ''
    });
  } else {
    snapshot.session = snapshot.session || session?._id || null;
    snapshot.contact = contactId || snapshot.contact || null;
    snapshot.user = userId || snapshot.user || null;
    snapshot.items = totals.items;
    snapshot.subtotal = Number(totals.subtotal.toFixed(2));
    snapshot.itemsCount = totals.itemsCount;
    snapshot.quantityCount = totals.quantityCount;
    snapshot.status = status || snapshot.status;
    snapshot.source = snapshot.source || source || '';
    snapshot.medium = snapshot.medium || medium || '';
    snapshot.campaign = snapshot.campaign || campaign || '';
    snapshot.contactName = contactName || snapshot.contactName || '';
    snapshot.contactPhone = contactPhone || snapshot.contactPhone || '';
    snapshot.contactEmail = contactEmail || snapshot.contactEmail || '';
    snapshot.lastActivityAt = now;
    if (status === 'checkout_started' && !snapshot.checkoutStartedAt) {
      snapshot.checkoutStartedAt = now;
    }
  }

  snapshot.suggestedMessage = await buildSuggestedMessage('cart_abandoned', {
    name: snapshot.contactName || 'cliente',
    productName: snapshot.items?.[0]?.title || 'tu carrito'
  });
  await snapshot.save();
  return snapshot;
};

export const markCartSnapshotConverted = async ({ sessionId = '', orderId = null, contactId = null }) => {
  if (!sessionId) return null;
  const snapshot = await CartSnapshot.findOne({
    sessionId,
    status: { $in: ['active', 'checkout_started', 'abandoned', 'contacted'] }
  }).sort({ updatedAt: -1 });
  if (!snapshot) return null;

  snapshot.status = 'converted';
  snapshot.order = orderId || snapshot.order || null;
  snapshot.contact = contactId || snapshot.contact || null;
  snapshot.convertedAt = new Date();
  await snapshot.save();
  return snapshot;
};
