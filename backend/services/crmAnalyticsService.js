import CRMContact from '../models/CRMContact.js';
import CRMEvent from '../models/CRMEvent.js';
import CRMTask from '../models/CRMTask.js';
import CartSnapshot from '../models/CartSnapshot.js';
import CustomerNote from '../models/CustomerNote.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { runCRMHousekeeping } from './crmAutomationService.js';
import { buildSuggestedMessage } from './crmMessageService.js';
import { getCRMConfig } from './crmConfigService.js';

export const getCRMDashboardData = async () => {
  await runCRMHousekeeping();
  const config = await getCRMConfig();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const recentWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    leadsNew,
    abandonedCarts,
    tasksDueToday,
    tasksOverdue,
    newCustomers,
    recurrentCustomers,
    inactiveCustomers,
    topInterestProductsRaw,
    overdueTasks,
    lowStockProducts
  ] = await Promise.all([
    CRMContact.countDocuments({ createdAt: { $gte: recentWindow }, status: { $in: ['visitor', 'new_lead', 'interested', 'contacted', 'link_sent'] } }),
    CartSnapshot.countDocuments({ status: { $in: ['abandoned', 'contacted'] } }),
    CRMTask.countDocuments({ status: { $in: ['pending', 'overdue'] }, dueDate: { $gte: todayStart, $lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) } }),
    CRMTask.countDocuments({ status: 'overdue' }),
    CRMContact.countDocuments({ createdAt: { $gte: recentWindow }, status: { $in: ['customer', 'vip'] } }),
    CRMContact.countDocuments({ ordersCount: { $gt: 1 } }),
    CRMContact.countDocuments({ status: 'inactive' }),
    CRMEvent.aggregate([
      { $match: { eventType: { $in: ['product_viewed', 'product_added_to_cart', 'product_interest_registered'] }, product: { $ne: null } } },
      { $group: { _id: '$product', interestCount: { $sum: 1 }, lastActivity: { $max: '$createdAt' } } },
      { $sort: { interestCount: -1 } },
      { $limit: 10 }
    ]),
    CRMTask.find({ status: { $in: ['pending', 'overdue'] } })
      .populate('contact', 'name phone whatsapp')
      .populate('relatedProduct', 'name')
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(8)
      .lean(),
    Product.find().lean()
  ]);

  const productIds = topInterestProductsRaw.map(item => item._id).filter(Boolean);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).lean()
    : [];
  const productMap = new Map(products.map(product => [product._id.toString(), product]));

  const topInterestProducts = topInterestProductsRaw.map(item => {
    const product = productMap.get(item._id.toString());
    return {
      productId: item._id,
      name: product?.name || 'Producto',
      stock: Object.values(product?.stockBySize || {}).reduce((acc, qty) => acc + Number(qty || 0), 0),
      interestCount: item.interestCount,
      lastActivity: item.lastActivity
    };
  });

  const lowStockThreshold = Number(config.lowStockThreshold || 5);
  const lowStockMap = new Map(
    lowStockProducts.map(product => [
      product._id.toString(),
      Object.values(product.stockBySize || {}).reduce((acc, qty) => acc + Number(qty || 0), 0)
    ])
  );

  const productsHighInterestLowStock = topInterestProducts
    .filter(item => Number(lowStockMap.get(item.productId.toString()) || item.stock || 0) <= lowStockThreshold)
    .slice(0, 6);

  const recommendedActions = [];
  overdueTasks.forEach(task => {
    recommendedActions.push({
      type: task.type,
      title: task.title,
      description: task.description || '',
      contactId: task.contact?._id || null,
      taskId: task._id
    });
  });

  return {
    metrics: {
      leadsNew,
      abandonedCarts,
      tasksDueToday,
      tasksOverdue,
      newCustomers,
      recurrentCustomers,
      inactiveCustomers
    },
    topInterestProducts,
    productsHighInterestLowStock,
    recommendedActions: recommendedActions.slice(0, 10)
  };
};

export const getCRMKanbanData = async () => {
  await runCRMHousekeeping();
  const contacts = await CRMContact.find()
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  const tasks = await CRMTask.find({ status: { $in: ['pending', 'overdue'] } })
    .sort({ dueDate: 1, createdAt: -1 })
    .lean();

  const latestEvents = await CRMEvent.aggregate([
    { $match: { contact: { $ne: null } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$contact', lastEventType: { $first: '$eventType' }, lastEventAt: { $first: '$createdAt' }, productId: { $first: '$product' } } }
  ]);
  const eventMap = new Map(latestEvents.map(item => [item._id.toString(), item]));

  return contacts.map(contact => {
    const lastEvent = eventMap.get(contact._id.toString());
    const nextTask = tasks.find(task => task.contact?.toString() === contact._id.toString());
    return {
      ...contact,
      lastEventType: lastEvent?.lastEventType || '',
      lastEventAt: lastEvent?.lastEventAt || contact.lastSeenAt,
      potentialCartValue: 0,
      nextTask: nextTask
        ? {
            _id: nextTask._id,
            title: nextTask.title,
            dueDate: nextTask.dueDate,
            status: nextTask.status
          }
        : null
    };
  });
};

export const getCRMContactDetail = async contactId => {
  await runCRMHousekeeping();
  const [contact, events, tasks, notes, orders, carts] = await Promise.all([
    CRMContact.findById(contactId).populate('user', 'name email role').lean(),
    CRMEvent.find({ contact: contactId })
      .populate('product', 'name code images')
      .populate('order', 'orderNumber total status createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    CRMTask.find({ contact: contactId })
      .populate('assignedTo', 'name email')
      .populate('relatedProduct', 'name code')
      .populate('relatedOrder', 'orderNumber total status')
      .populate('relatedCartSnapshot')
      .sort({ dueDate: 1, createdAt: -1 })
      .lean(),
    CustomerNote.find({ contact: contactId })
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .lean(),
    Order.find({ crmContact: contactId }).sort({ createdAt: -1 }).lean(),
    CartSnapshot.find({ contact: contactId }).sort({ updatedAt: -1 }).lean()
  ]);

  if (!contact) {
    return null;
  }

  const viewedProductsMap = new Map();
  events.forEach(event => {
    if (event.product?._id) {
      viewedProductsMap.set(event.product._id.toString(), event.product);
    }
  });

  return {
    contact,
    events,
    tasks,
    notes,
    orders,
    carts,
    viewedProducts: Array.from(viewedProductsMap.values()),
    suggestedMessages: {
      cart_abandoned: await buildSuggestedMessage('cart_abandoned', {
        name: contact.name || 'cliente',
        productName: viewedProductsMap.values().next().value?.name || 'tu carrito'
      }),
      product_viewed: await buildSuggestedMessage('product_viewed', {
        name: contact.name || 'cliente',
        productName: viewedProductsMap.values().next().value?.name || 'este producto'
      }),
      stock_back_available: await buildSuggestedMessage('stock_back_available', {
        name: contact.name || 'cliente',
        productName: viewedProductsMap.values().next().value?.name || 'este producto',
        link: viewedProductsMap.values().next().value?._id ? `/product/${viewedProductsMap.values().next().value._id}` : ''
      }),
      post_sale: await buildSuggestedMessage('post_sale', {
        name: contact.name || 'cliente',
        productName: orders[0]?.items?.[0]?.title || 'tu compra'
      })
    }
  };
};

export const getAbandonedCartsData = async () => {
  await runCRMHousekeeping();
  return CartSnapshot.find({ status: { $in: ['abandoned', 'contacted'] } })
    .populate('contact', 'name phone whatsapp email status tags totalSpent ordersCount')
    .sort({ abandonedAt: -1, updatedAt: -1 })
    .lean();
};

export const getProductInterestSummary = async productId => {
  await runCRMHousekeeping();
  const [eventsAgg, interestedContacts, abandonedCarts, product] = await Promise.all([
    CRMEvent.aggregate([
      { $match: { product: productId } },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      }
    ]),
    CRMContact.find({ interestedProducts: productId })
      .select('name phone whatsapp email status lastSeenAt')
      .limit(20)
      .lean(),
    CartSnapshot.find({ 'items.product': productId, status: { $in: ['abandoned', 'contacted'] } })
      .populate('contact', 'name phone whatsapp status')
      .limit(20)
      .lean(),
    Product.findById(productId).lean()
  ]);

  if (!product) {
    return null;
  }

  const counts = eventsAgg.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  return {
    productId,
    productName: product.name,
    stockCurrent: Object.values(product.stockBySize || {}).reduce((acc, qty) => acc + Number(qty || 0), 0),
    productViews: counts.product_viewed || 0,
    addedToCart: counts.product_added_to_cart || 0,
    interestedCustomers: interestedContacts.length,
    abandonedCartsCount: abandonedCarts.length,
    salesCount: Object.values(product.soldBySize || {}).reduce((acc, qty) => acc + Number(qty || 0), 0),
    interestedContacts,
    relatedAbandonedCarts: abandonedCarts,
    replenishmentRecommendation:
      interestedContacts.length > 0 &&
      Object.values(product.stockBySize || {}).reduce((acc, qty) => acc + Number(qty || 0), 0) <= Number((await getCRMConfig()).lowStockThreshold || 5)
        ? 'Reponer este producto: hay interes acumulado con stock bajo.'
        : ''
  };
};
