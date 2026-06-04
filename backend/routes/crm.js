import express from 'express';
import { protect, adminOnly, requirePermission } from '../middleware/authMiddleware.js';
import { requireModuleEnabled } from '../middleware/moduleMiddleware.js';
import CRMContact from '../models/CRMContact.js';
import CRMTask from '../models/CRMTask.js';
import CartSnapshot from '../models/CartSnapshot.js';
import CustomerNote from '../models/CustomerNote.js';
import { CRM_TASK_STATUSES } from '../models/CRMTask.js';
import { CRM_STATUSES } from '../models/CRMContact.js';
import { getCRMConfig } from '../services/crmConfigService.js';
import { getCRMDashboardData, getCRMKanbanData, getCRMContactDetail, getAbandonedCartsData, getProductInterestSummary } from '../services/crmAnalyticsService.js';
import { findContactByIdentity, upsertCRMContact } from '../services/crmContactService.js';
import { createCRMEvent } from '../services/crmEventService.js';
import { buildSuggestedMessage } from '../services/crmMessageService.js';
import { normalizeEmail, normalizePhone, sanitizeTags } from '../utils/crmIdentity.js';
import { normalizeLeadCode } from '../utils/leadCode.js';

const router = express.Router();

router.use(protect, adminOnly, requireModuleEnabled('crm'));

const parseBoolean = value => value === true || value === 'true';

router.get('/dashboard', requirePermission('crm', 'dashboard'), async (req, res) => {
  const data = await getCRMDashboardData();
  res.json(data);
});

router.get('/pipeline', requirePermission('crm', 'pipelineView'), async (req, res) => {
  const contacts = await getCRMKanbanData();
  res.json(contacts);
});

router.get('/contacts', requirePermission('crm', 'contactsView'), async (req, res) => {
  const {
    q = '',
    status = '',
    tag = '',
    onlyActionable = 'false'
  } = req.query || {};

  const query = {};
  if (status) {
    query.status = status;
  }
  if (tag) {
    query.tags = tag;
  }
  if (parseBoolean(onlyActionable)) {
    query.status = { $in: ['new_lead', 'contacted', 'link_sent', 'interested', 'cart_abandoned', 'inactive'] };
  }
  if (q) {
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { whatsapp: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { leadCode: { $regex: q, $options: 'i' } },
      { leadCodeHistory: { $regex: q, $options: 'i' } }
    ];
  }

  const contacts = await CRMContact.find(query)
    .sort({ lastSeenAt: -1, updatedAt: -1 })
    .limit(300)
    .lean();

  const statuses = CRM_STATUSES.map(value => ({ value, label: value }));
  res.json({ contacts, statuses });
});

router.post('/contacts', requirePermission('crm', 'contactsEdit'), async (req, res) => {
  const contact = await upsertCRMContact({
    userId: req.body?.userId || null,
    name: req.body?.name || '',
    phone: req.body?.phone || '',
    whatsapp: req.body?.whatsapp || req.body?.phone || '',
    email: req.body?.email || '',
    source: req.body?.source || '',
    medium: req.body?.medium || '',
    campaign: req.body?.campaign || '',
    leadCode: req.body?.leadCode || '',
    status: req.body?.status || 'new_lead',
    tags: sanitizeTags(req.body?.tags || []),
    notes: req.body?.notes || '',
    interestedProductId: req.body?.interestedProductId || null,
    lastSeenAt: new Date()
  });

  if (contact?._id) {
    await createCRMEvent({
      contactId: contact._id,
      adminId: req.user?._id || null,
      eventType: 'manual_contact_done',
      productId: req.body?.interestedProductId || null,
      metadata: {
        createdFrom: 'admin_crm'
      }
    });
  }

  res.status(201).json(contact);
});

router.get('/contacts/:id', requirePermission('crm', 'contactsView'), async (req, res) => {
  const detail = await getCRMContactDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({ message: 'Contacto no encontrado' });
  }
  res.json(detail);
});

router.put('/contacts/:id', requirePermission('crm', 'contactsEdit'), async (req, res) => {
  const contact = await CRMContact.findById(req.params.id);
  if (!contact) {
    return res.status(404).json({ message: 'Contacto no encontrado' });
  }

  [
    'name',
    'phone',
    'whatsapp',
    'email',
    'source',
    'medium',
    'campaign',
    'status',
    'notes'
  ].forEach(field => {
    if (req.body?.[field] !== undefined) {
      contact[field] = req.body[field];
    }
  });

  if (Array.isArray(req.body?.tags)) {
    contact.tags = sanitizeTags(req.body.tags);
  }

  if (req.body?.phone !== undefined) {
    contact.phoneNormalized = normalizePhone(req.body.phone);
  }
  if (req.body?.whatsapp !== undefined) {
    contact.whatsappNormalized = normalizePhone(req.body.whatsapp);
  } else if (req.body?.phone !== undefined) {
    contact.whatsappNormalized = normalizePhone(req.body.phone);
  }
  if (req.body?.email !== undefined) {
    contact.emailNormalized = normalizeEmail(req.body.email);
  }

  contact.lastContactedAt = req.body?.markContacted ? new Date() : contact.lastContactedAt;
  contact.lastSeenAt = new Date();
  await contact.save();

  if (req.body?.markContacted) {
    await createCRMEvent({
      contactId: contact._id,
      adminId: req.user?._id || null,
      eventType: 'manual_contact_done',
      metadata: {
        note: req.body?.contactNote || ''
      }
    });
  }

  res.json(contact);
});

router.post('/contacts/:id/notes', requirePermission('crm', 'contactsEdit'), async (req, res) => {
  const noteValue = String(req.body?.note || '').trim();
  if (!noteValue) {
    return res.status(400).json({ message: 'La nota es obligatoria' });
  }

  const note = await CustomerNote.create({
    contact: req.params.id,
    admin: req.user._id,
    note: noteValue
  });

  await createCRMEvent({
    contactId: req.params.id,
    adminId: req.user?._id || null,
    eventType: 'manual_contact_done',
    metadata: {
      note: noteValue,
      source: 'customer_note'
    }
  });

  const populated = await note.populate('admin', 'name email');
  res.status(201).json(populated);
});

router.post('/contacts/link-whatsapp', requirePermission('crm', 'contactsEdit'), async (req, res) => {
  const leadCode = normalizeLeadCode(req.body?.leadCode);
  if (!leadCode) {
    return res.status(400).json({ message: 'La referencia del lead es obligatoria' });
  }

  const contact = await findContactByIdentity({
    leadCode
  });

  if (!contact) {
    return res.status(404).json({ message: 'No se encontro un lead con esa referencia' });
  }

  const nextName = String(req.body?.name || '').trim();
  const nextPhone = String(req.body?.phone || '').trim();
  const nextWhatsapp = String(req.body?.whatsapp || nextPhone).trim();
  const nextStatus = String(req.body?.status || 'contacted').trim();
  const noteValue = String(req.body?.note || '').trim();

  if (nextName) {
    contact.name = nextName;
  }
  if (nextPhone) {
    contact.phone = nextPhone;
    contact.phoneNormalized = normalizePhone(nextPhone);
  }
  if (nextWhatsapp) {
    contact.whatsapp = nextWhatsapp;
    contact.whatsappNormalized = normalizePhone(nextWhatsapp);
  } else if (nextPhone) {
    contact.whatsapp = nextPhone;
    contact.whatsappNormalized = normalizePhone(nextPhone);
  }
  contact.leadCode = leadCode;
  contact.leadCodeHistory = Array.from(new Set([...(contact.leadCodeHistory || []), leadCode]));
  contact.status = nextStatus || contact.status;
  contact.lastContactedAt = new Date();
  contact.lastSeenAt = new Date();
  await contact.save();

  if (noteValue) {
    await CustomerNote.create({
      contact: contact._id,
      admin: req.user._id,
      note: noteValue
    });
  }

  await createCRMEvent({
    contactId: contact._id,
    adminId: req.user?._id || null,
    eventType: 'manual_contact_done',
    metadata: {
      source: 'whatsapp_manual_link',
      leadCode,
      phone: nextPhone,
      whatsapp: nextWhatsapp,
      note: noteValue
    }
  });

  res.json(contact);
});

router.get('/tasks', requirePermission('crm', 'tasksView'), async (req, res) => {
  const { status = '', assignedTo = '', contactId = '' } = req.query || {};
  const query = {};
  if (status) query.status = status;
  if (assignedTo) query.assignedTo = assignedTo;
  if (contactId) query.contact = contactId;

  const tasks = await CRMTask.find(query)
    .populate('contact', 'name phone whatsapp email status')
    .populate('assignedTo', 'name email')
    .populate('relatedProduct', 'name code')
    .populate('relatedOrder', 'orderNumber total status')
    .sort({ dueDate: 1, createdAt: -1 })
    .limit(300)
    .lean();

  res.json({
    tasks,
    statuses: CRM_TASK_STATUSES
  });
});

router.post('/tasks', requirePermission('crm', 'tasksManage'), async (req, res) => {
  const task = await CRMTask.create({
    contact: req.body?.contact,
    assignedTo: req.body?.assignedTo || req.user._id,
    title: req.body?.title,
    description: req.body?.description || '',
    type: req.body?.type || 'follow_up',
    dueDate: req.body?.dueDate || null,
    status: req.body?.status || 'pending',
    priority: req.body?.priority || 'medium',
    relatedProduct: req.body?.relatedProduct || null,
    relatedOrder: req.body?.relatedOrder || null,
    relatedCartSnapshot: req.body?.relatedCartSnapshot || null,
    suggestedMessage:
      req.body?.suggestedMessage ||
      (await buildSuggestedMessage(req.body?.type || 'follow_up', {
        name: req.body?.contactName || 'cliente',
        productName: req.body?.productName || 'tu interes'
      }))
  });

  await createCRMEvent({
    contactId: task.contact,
    adminId: req.user?._id || null,
    eventType: 'follow_up_created',
    productId: task.relatedProduct || null,
    orderId: task.relatedOrder || null,
    cartSnapshotId: task.relatedCartSnapshot || null,
    metadata: {
      taskId: task._id,
      title: task.title,
      type: task.type
    }
  });

  const populated = await CRMTask.findById(task._id)
    .populate('contact', 'name phone whatsapp email status')
    .populate('assignedTo', 'name email')
    .populate('relatedProduct', 'name code')
    .populate('relatedOrder', 'orderNumber total status')
    .lean();

  res.status(201).json(populated);
});

router.patch('/tasks/:id', requirePermission('crm', 'tasksManage'), async (req, res) => {
  const task = await CRMTask.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: 'Tarea no encontrada' });
  }

  [
    'title',
    'description',
    'type',
    'dueDate',
    'status',
    'priority',
    'assignedTo',
    'relatedProduct',
    'relatedOrder',
    'relatedCartSnapshot',
    'suggestedMessage'
  ].forEach(field => {
    if (req.body?.[field] !== undefined) {
      task[field] = req.body[field];
    }
  });

  if (task.status === 'done' && !task.completedAt) {
    task.completedAt = new Date();
  }
  if (task.status === 'cancelled' && !task.cancelledAt) {
    task.cancelledAt = new Date();
  }

  await task.save();

  if (req.body?.status === 'done') {
    await createCRMEvent({
      contactId: task.contact,
      adminId: req.user?._id || null,
      eventType: 'manual_contact_done',
      productId: task.relatedProduct || null,
      orderId: task.relatedOrder || null,
      cartSnapshotId: task.relatedCartSnapshot || null,
      metadata: {
        taskId: task._id,
        title: task.title
      }
    });
  }

  const populated = await CRMTask.findById(task._id)
    .populate('contact', 'name phone whatsapp email status')
    .populate('assignedTo', 'name email')
    .populate('relatedProduct', 'name code')
    .populate('relatedOrder', 'orderNumber total status')
    .lean();

  res.json(populated);
});

router.get('/abandoned-carts', requirePermission('crm', 'abandonedView'), async (req, res) => {
  const carts = await getAbandonedCartsData();
  res.json(carts);
});

router.patch('/abandoned-carts/:id', requirePermission('crm', 'abandonedManage'), async (req, res) => {
  const cart = await CartSnapshot.findById(req.params.id);
  if (!cart) {
    return res.status(404).json({ message: 'Carrito no encontrado' });
  }

  const nextStatus = String(req.body?.status || '').trim();
  if (!['contacted', 'recovered', 'discarded'].includes(nextStatus)) {
    return res.status(400).json({ message: 'Estado no valido' });
  }

  cart.status = nextStatus;
  if (nextStatus === 'contacted') {
    cart.contactedAt = new Date();
  }
  if (nextStatus === 'recovered') {
    cart.recoveredAt = new Date();
  }
  if (nextStatus === 'discarded') {
    cart.discardedAt = new Date();
  }
  await cart.save();

  if (cart.contact) {
    await createCRMEvent({
      contactId: cart.contact,
      cartSnapshotId: cart._id,
      adminId: req.user?._id || null,
      eventType: 'manual_contact_done',
      productId: cart.items?.[0]?.product || null,
      metadata: {
        abandonedCartStatus: nextStatus
      }
    });
  }

  res.json(cart);
});

router.get('/products/:id/interest', requirePermission('crm', 'productInterestView'), async (req, res) => {
  const summary = await getProductInterestSummary(req.params.id);
  if (!summary) {
    return res.status(404).json({ message: 'Producto no encontrado' });
  }
  res.json(summary);
});

router.get('/config', requirePermission('crm', 'configManage'), async (req, res) => {
  const config = await getCRMConfig();
  res.json(config);
});

router.put('/config', requirePermission('crm', 'configManage'), async (req, res) => {
  const config = await getCRMConfig();

  [
    'abandonedCartHours',
    'postSaleFollowUpDays',
    'inactiveCustomerDays',
    'vipSpendThreshold',
    'lowStockThreshold',
    'frequentCustomerOrdersThreshold',
    'trackingEnabled'
  ].forEach(field => {
    if (req.body?.[field] !== undefined) {
      config[field] = req.body[field];
    }
  });

  if (Array.isArray(req.body?.statuses)) {
    config.statuses = req.body.statuses;
  }
  if (Array.isArray(req.body?.tags)) {
    config.tags = req.body.tags;
  }
  if (req.body?.suggestedMessages && typeof req.body.suggestedMessages === 'object') {
    config.suggestedMessages = req.body.suggestedMessages;
  }

  await config.save();
  res.json(config);
});

export default router;
