import Product from '../models/Product.js';
import CartSnapshot from '../models/CartSnapshot.js';
import CRMContact from '../models/CRMContact.js';
import CRMTask from '../models/CRMTask.js';
import { getCRMConfig } from './crmConfigService.js';
import { buildSuggestedMessage } from './crmMessageService.js';
import { createCRMEvent } from './crmEventService.js';
import { refreshOverdueTasks, upsertOpenTask } from './crmTaskService.js';
import { sanitizeTags } from '../utils/crmIdentity.js';
import { syncContactMetrics } from './crmContactService.js';

export const refreshInactiveContacts = async () => {
  const config = await getCRMConfig();
  const cutoff = new Date(Date.now() - Number(config.inactiveCustomerDays || 45) * 24 * 60 * 60 * 1000);

  await CRMContact.updateMany(
    {
      status: { $in: ['customer', 'interested', 'contacted', 'link_sent'] },
      lastSeenAt: { $lt: cutoff }
    },
    { $set: { status: 'inactive' } }
  );
};

export const processAbandonedCarts = async () => {
  const config = await getCRMConfig();
  const cutoff = new Date(Date.now() - Number(config.abandonedCartHours || 4) * 60 * 60 * 1000);
  const candidates = await CartSnapshot.find({
    status: { $in: ['active', 'checkout_started'] },
    itemsCount: { $gt: 0 },
    lastActivityAt: { $lte: cutoff }
  });

  const results = [];

  for (const snapshot of candidates) {
    snapshot.status = 'abandoned';
    snapshot.abandonedAt = snapshot.abandonedAt || new Date();
    snapshot.suggestedMessage = await buildSuggestedMessage('cart_abandoned', {
      name: snapshot.contactName || 'cliente',
      productName: snapshot.items?.[0]?.title || 'tu carrito'
    });
    await snapshot.save();

    if (snapshot.contact) {
      const contact = await CRMContact.findById(snapshot.contact);
      if (contact) {
        contact.status = 'cart_abandoned';
        contact.tags = sanitizeTags([...(contact.tags || []), 'cart_abandoned']);
        await contact.save();

        await createCRMEvent({
          contactId: contact._id,
          sessionId: snapshot.sessionId,
          eventType: 'cart_abandoned',
          cartSnapshotId: snapshot._id,
          productId: snapshot.items?.[0]?.product || null,
          metadata: {
            subtotal: snapshot.subtotal,
            itemsCount: snapshot.itemsCount
          }
        });

        if (snapshot.contactPhone || contact.phone || contact.whatsapp) {
          await upsertOpenTask({
            contact: contact._id,
            type: 'abandoned_cart',
            relatedCartSnapshot: snapshot._id,
            title: 'Contactar carrito abandonado',
            description: `Carrito abandonado por ${snapshot.contactName || contact.name || 'cliente'}.`,
            dueDate: new Date(Date.now() + 60 * 60 * 1000),
            priority: 'high',
            relatedProduct: snapshot.items?.[0]?.product || null,
            suggestedMessage: snapshot.suggestedMessage
          });
        }
      }
    }

    results.push(snapshot);
  }

  return results;
};

export const handlePaidOrderAutomation = async ({ order, contact }) => {
  const synced = await syncContactMetrics(contact._id);
  const config = await getCRMConfig();
  const dueDate = new Date(Date.now() + Number(config.postSaleFollowUpDays || 3) * 24 * 60 * 60 * 1000);

  await upsertOpenTask({
    contact: synced._id,
    type: 'post_sale',
    relatedOrder: order._id,
    title: 'Seguimiento postventa',
    description: `Confirmar recepcion del pedido #${order.orderNumber || order._id.toString().slice(-6)}.`,
    dueDate,
    priority: 'medium',
    suggestedMessage: await buildSuggestedMessage('post_sale', {
      name: synced.name || order.contactName || 'cliente',
      productName: order.items?.[0]?.title || 'tu compra'
    })
  });

  await createCRMEvent({
    contactId: synced._id,
    orderId: order._id,
    eventType: 'order_paid',
    productId: order.items?.[0]?.product || null,
    metadata: {
      total: order.total,
      orderNumber: order.orderNumber
    }
  });

  return synced;
};

export const handleProductBackInStock = async productId => {
  const product = await Product.findById(productId).lean();
  if (!product) return { product: null, contacts: [] };

  const totalStock = Object.values(product.stockBySize || {}).reduce((acc, qty) => acc + Number(qty || 0), 0);
  if (totalStock <= 0) {
    return { product, contacts: [] };
  }

  const interestedContacts = await CRMContact.find({ interestedProducts: product._id }).limit(200);
  const tasks = [];

  for (const contact of interestedContacts) {
    const suggestedMessage = await buildSuggestedMessage('stock_back_available', {
      name: contact.name || 'cliente',
      productName: product.name,
      link: `/product/${product._id}`
    });

    tasks.push(
      upsertOpenTask({
        contact: contact._id,
        type: 'stock_alert',
        relatedProduct: product._id,
        title: `Avisar reposicion de ${product.name}`,
        description: 'Producto nuevamente disponible con interes previo registrado.',
        dueDate: new Date(),
        priority: 'high',
        suggestedMessage
      })
    );

    await createCRMEvent({
      contactId: contact._id,
      eventType: 'stock_back_available',
      productId: product._id,
      metadata: {
        stock: totalStock
      }
    });
  }

  await Promise.all(tasks);
  return { product, contacts: interestedContacts };
};

export const runCRMHousekeeping = async () => {
  await refreshOverdueTasks();
  await refreshInactiveContacts();
  await processAbandonedCarts();
};
