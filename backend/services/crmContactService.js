import CRMContact from '../models/CRMContact.js';
import Order from '../models/Order.js';
import { getCRMConfig } from './crmConfigService.js';
import { normalizeEmail, normalizePhone, sanitizeTags, uniqueObjectIds } from '../utils/crmIdentity.js';
import { normalizeLeadCode } from '../utils/leadCode.js';

const CONTACT_STATUS_PRIORITY = {
  visitor: 1,
  new_lead: 2,
  contacted: 3,
  link_sent: 4,
  interested: 5,
  cart_abandoned: 6,
  customer: 7,
  vip: 8,
  inactive: 9,
  lost: 10
};

const mergeStatus = (currentStatus, nextStatus) => {
  if (!nextStatus) return currentStatus || 'visitor';
  if (!currentStatus) return nextStatus;
  return (CONTACT_STATUS_PRIORITY[nextStatus] || 0) > (CONTACT_STATUS_PRIORITY[currentStatus] || 0)
    ? nextStatus
    : currentStatus;
};

export const findContactByIdentity = async ({ contactId = null, userId = null, phone = '', email = '', leadCode = '' }) => {
  if (contactId) {
    const direct = await CRMContact.findById(contactId);
    if (direct) return direct;
  }

  const phoneNormalized = normalizePhone(phone);
  const emailNormalized = normalizeEmail(email);
  const normalizedLeadCode = normalizeLeadCode(leadCode);
  const orConditions = [];
  if (userId) orConditions.push({ user: userId });
  if (phoneNormalized) orConditions.push({ phoneNormalized });
  if (emailNormalized) orConditions.push({ emailNormalized });
  if (normalizedLeadCode) {
    orConditions.push({ leadCode: normalizedLeadCode });
    orConditions.push({ leadCodeHistory: normalizedLeadCode });
  }

  if (!orConditions.length) {
    return null;
  }

  return CRMContact.findOne({ $or: orConditions });
};

export const upsertCRMContact = async ({
  userId = null,
  ownerId = null,
  contactId = null,
  name = '',
  phone = '',
  whatsapp = '',
  email = '',
  source = '',
  medium = '',
  campaign = '',
  leadCode = '',
  status = '',
  tags = [],
  notes = '',
  interestedProductId = null,
  lastSeenAt = new Date()
}) => {
  const phoneNormalized = normalizePhone(phone || whatsapp);
  const whatsappNormalized = normalizePhone(whatsapp || phone);
  const emailNormalized = normalizeEmail(email);
  const normalizedLeadCode = normalizeLeadCode(leadCode);

  let contact = await findContactByIdentity({
    contactId,
    userId,
    phone: phoneNormalized,
    email: emailNormalized,
    leadCode: normalizedLeadCode
  });

  if (!contact) {
    contact = new CRMContact({
      user: userId || null,
      owner: ownerId || null,
      name: name || '',
      phone: phone || '',
      phoneNormalized,
      whatsapp: whatsapp || phone || '',
      whatsappNormalized,
      email: email || '',
      emailNormalized,
      leadCode: normalizedLeadCode,
      leadCodeHistory: normalizedLeadCode ? [normalizedLeadCode] : [],
      source: source || '',
      medium: medium || '',
      campaign: campaign || '',
      status: status || (phoneNormalized || emailNormalized ? 'new_lead' : 'visitor'),
      tags: sanitizeTags(tags),
      notes: notes || '',
      firstSeenAt: lastSeenAt,
      lastSeenAt
    });
  } else {
    if (!contact.user && userId) contact.user = userId;
    if (!contact.owner && ownerId) contact.owner = ownerId;
    if (!contact.name && name) contact.name = name;
    if (!contact.phone && phone) contact.phone = phone;
    if (!contact.phoneNormalized && phoneNormalized) contact.phoneNormalized = phoneNormalized;
    if (!contact.whatsapp && (whatsapp || phone)) contact.whatsapp = whatsapp || phone;
    if (!contact.whatsappNormalized && whatsappNormalized) contact.whatsappNormalized = whatsappNormalized;
    if (!contact.email && email) contact.email = email;
    if (!contact.emailNormalized && emailNormalized) contact.emailNormalized = emailNormalized;
    if (normalizedLeadCode) {
      contact.leadCode = normalizedLeadCode;
      contact.leadCodeHistory = Array.from(new Set([...(contact.leadCodeHistory || []), normalizedLeadCode]));
    }
    if (!contact.source && source) contact.source = source;
    if (!contact.medium && medium) contact.medium = medium;
    if (!contact.campaign && campaign) contact.campaign = campaign;
    contact.status = mergeStatus(contact.status, status || undefined);
    if (notes && !contact.notes) {
      contact.notes = notes;
    }
    contact.tags = sanitizeTags([...(contact.tags || []), ...tags]);
    contact.lastSeenAt = lastSeenAt;
  }

  if (interestedProductId) {
    contact.interestedProducts = uniqueObjectIds([
      ...(contact.interestedProducts || []),
      interestedProductId
    ]);
  }

  await contact.save();
  return contact;
};

export const syncContactMetrics = async contactId => {
  const contact = await CRMContact.findById(contactId);
  if (!contact) return null;

  const orders = await Order.find({ crmContact: contact._id, status: { $in: ['PAGADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO'] } })
    .select('total confirmedAt createdAt')
    .lean();

  contact.totalSpent = orders.reduce((acc, order) => acc + Number(order.total || 0), 0);
  contact.ordersCount = orders.length;
  contact.lastPurchasedAt = orders.length
    ? orders
        .map(order => order.confirmedAt || order.createdAt)
        .sort((a, b) => new Date(b) - new Date(a))[0]
    : null;

  const config = await getCRMConfig();
  if (contact.ordersCount >= Number(config.frequentCustomerOrdersThreshold || 3)) {
    contact.tags = sanitizeTags([...(contact.tags || []), 'frequent_customer']);
  }
  if (contact.totalSpent >= Number(config.vipSpendThreshold || 0)) {
    contact.tags = sanitizeTags([...(contact.tags || []), 'vip']);
    contact.status = 'vip';
  } else if (contact.ordersCount > 0) {
    contact.status = mergeStatus(contact.status, 'customer');
  }

  await contact.save();
  return contact;
};
