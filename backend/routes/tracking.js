import express from 'express';
import { optionalProtect } from '../middleware/authMiddleware.js';
import { requireModuleEnabled } from '../middleware/moduleMiddleware.js';
import { getOrCreateVisitorSession, linkVisitorSessionToContact } from '../services/visitorTrackingService.js';
import { upsertCRMContact } from '../services/crmContactService.js';
import { createCRMEvent } from '../services/crmEventService.js';
import { upsertCartSnapshot } from '../services/cartSnapshotService.js';
import { generateLeadCode, normalizeLeadCode } from '../utils/leadCode.js';

const router = express.Router();

router.use(optionalProtect, requireModuleEnabled('crm'));

router.post('/session', async (req, res) => {
  const { session, sessionId, trackingEnabled } = await getOrCreateVisitorSession(req);

  if (trackingEnabled) {
    await createCRMEvent({
      session,
      sessionId,
      contactId: session?.contact || null,
      eventType: 'store_visited',
      metadata: {
        path: req.body?.landingPage || req.originalUrl,
        source: session?.source || '',
        medium: session?.medium || '',
        campaign: session?.campaign || ''
      }
    });
  }

  res.json({
    trackingEnabled,
    sessionId,
    source: session?.source || '',
    medium: session?.medium || '',
    campaign: session?.campaign || ''
  });
});

router.post('/product-view', async (req, res) => {
  const { productId = '' } = req.body || {};
  const { session, sessionId, trackingEnabled } = await getOrCreateVisitorSession(req);

  if (!trackingEnabled) {
    return res.status(202).json({ tracked: false, sessionId });
  }

  let contactId = session?.contact || null;
  if ((req.body?.phone || req.body?.email) && productId) {
    const contact = await upsertCRMContact({
      userId: req.user?._id ?? null,
      name: req.body?.name || '',
      phone: req.body?.phone || '',
      whatsapp: req.body?.phone || '',
      email: req.body?.email || '',
      source: session?.source || '',
      medium: session?.medium || '',
      campaign: session?.campaign || '',
      status: 'interested',
      interestedProductId: productId,
      lastSeenAt: new Date()
    });
    contactId = contact?._id || null;
    if (contactId) {
      await linkVisitorSessionToContact({
        session,
        sessionId,
        contactId,
        userId: req.user?._id ?? null
      });
    }
  }

  await createCRMEvent({
    session,
    sessionId,
    contactId,
    eventType: 'product_viewed',
    productId: productId || null,
    metadata: {
      path: req.body?.path || '',
      title: req.body?.title || ''
    }
  });

  res.json({ tracked: true, sessionId });
});

router.post('/whatsapp-click', async (req, res) => {
  const { productId = '' } = req.body || {};
  const { session, sessionId, trackingEnabled } = await getOrCreateVisitorSession(req);
  const leadCode = normalizeLeadCode(req.body?.leadCode) || generateLeadCode();

  if (!trackingEnabled) {
    return res.status(202).json({ tracked: false, sessionId, leadCode });
  }

  let contact = null;
  if (session?.contact || req.user?._id) {
    contact = await upsertCRMContact({
      userId: req.user?._id ?? null,
      contactId: session?.contact || null,
      name: req.user?.name || '',
      phone: '',
      whatsapp: '',
      email: req.user?.email || '',
      source: session?.source || '',
      medium: session?.medium || '',
      campaign: session?.campaign || '',
      leadCode,
      status: 'interested',
      interestedProductId: productId || null,
      lastSeenAt: new Date()
    });
  } else {
    contact = await upsertCRMContact({
      userId: null,
      contactId: null,
      name: '',
      phone: '',
      whatsapp: '',
      email: '',
      source: session?.source || '',
      medium: session?.medium || '',
      campaign: session?.campaign || '',
      leadCode,
      status: 'interested',
      interestedProductId: productId || null,
      lastSeenAt: new Date()
    });
  }

  if (contact?._id) {
    await linkVisitorSessionToContact({
      session,
      sessionId,
      contactId: contact._id,
      userId: req.user?._id ?? null
    });
  }

  await createCRMEvent({
    session,
    sessionId,
    contactId: contact?._id || session?.contact || null,
    eventType: 'whatsapp_clicked',
    productId: productId || null,
    metadata: {
      leadCode,
      href: req.body?.href || '',
      title: req.body?.title || ''
    }
  });

  res.json({ tracked: true, sessionId, leadCode, contactId: contact?._id || session?.contact || null });
});

router.post('/contact-capture', async (req, res) => {
  const { name = '', phone = '', email = '', productId = '' } = req.body || {};
  const { session, sessionId, trackingEnabled } = await getOrCreateVisitorSession(req);

  const contact = await upsertCRMContact({
    userId: req.user?._id ?? null,
    name,
    phone,
    whatsapp: phone,
    email,
    source: session?.source || '',
    medium: session?.medium || '',
    campaign: session?.campaign || '',
    status: phone || email ? 'new_lead' : 'visitor',
    interestedProductId: productId || null,
    lastSeenAt: new Date()
  });

  if (contact?._id) {
    await linkVisitorSessionToContact({
      session,
      sessionId,
      contactId: contact._id,
      userId: req.user?._id ?? null
    });
  }

  if (trackingEnabled && contact?._id) {
    await createCRMEvent({
      session,
      sessionId,
      contactId: contact._id,
      eventType: 'phone_entered',
      productId: productId || null,
      metadata: {
        capturedName: name,
        capturedEmail: email
      }
    });
  }

  res.json({
    tracked: Boolean(contact?._id),
    sessionId,
    contactId: contact?._id || null
  });
});

router.post('/cart', async (req, res) => {
  const {
    items = [],
    status = 'active',
    contactName = '',
    contactPhone = '',
    contactEmail = '',
    eventType = ''
  } = req.body || {};

  const { session, sessionId, trackingEnabled } = await getOrCreateVisitorSession(req);

  let contact = null;
  if (contactName || contactPhone || contactEmail || session?.contact) {
    contact = await upsertCRMContact({
      userId: req.user?._id ?? null,
      contactId: session?.contact || null,
      name: contactName,
      phone: contactPhone,
      whatsapp: contactPhone,
      email: contactEmail,
      source: session?.source || '',
      medium: session?.medium || '',
      campaign: session?.campaign || '',
      status: status === 'checkout_started' ? 'interested' : 'new_lead',
      interestedProductId: items?.[0]?.productId || items?.[0]?.product || null,
      lastSeenAt: new Date()
    });
  }

  if (contact?._id) {
    await linkVisitorSessionToContact({
      session,
      sessionId,
      contactId: contact._id,
      userId: req.user?._id ?? null
    });
  }

  const snapshot = await upsertCartSnapshot({
    session,
    sessionId,
    contactId: contact?._id || session?.contact || null,
    userId: req.user?._id ?? null,
    items,
    status,
    source: session?.source || '',
    medium: session?.medium || '',
    campaign: session?.campaign || '',
    contactName,
    contactPhone,
    contactEmail
  });

  if (trackingEnabled) {
    const normalizedEventType = eventType || (status === 'checkout_started' ? 'checkout_started' : items.length ? 'product_added_to_cart' : 'cart_created');
    await createCRMEvent({
      session,
      sessionId,
      contactId: contact?._id || session?.contact || null,
      eventType: normalizedEventType,
      productId: items?.[0]?.productId || items?.[0]?.product || null,
      cartSnapshotId: snapshot._id,
      metadata: {
        subtotal: snapshot.subtotal,
        itemsCount: snapshot.itemsCount,
        quantityCount: snapshot.quantityCount
      }
    });
  }

  res.json({
    tracked: true,
    sessionId,
    snapshotId: snapshot._id,
    status: snapshot.status
  });
});

export default router;
