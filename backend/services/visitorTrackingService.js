import crypto from 'crypto';
import VisitorSession from '../models/VisitorSession.js';
import { getCRMConfig } from './crmConfigService.js';
import { getVisitorSessionIdFromRequest, hashIp } from '../utils/crmIdentity.js';

export const generateVisitorSessionId = () => crypto.randomUUID();

export const extractTrackingPayload = req => ({
  source: String(req.body?.source || req.query?.utm_source || '').trim(),
  medium: String(req.body?.medium || req.query?.utm_medium || '').trim(),
  campaign: String(req.body?.campaign || req.query?.utm_campaign || '').trim(),
  landingPage: String(req.body?.landingPage || req.query?.landingPage || req.originalUrl || '').trim(),
  referrer: String(req.body?.referrer || req.get('referer') || '').trim(),
  userAgent: String(req.body?.userAgent || req.get('user-agent') || '').trim(),
  ipHash: hashIp(req.ip || req.headers['x-forwarded-for'] || '')
});

export const getOrCreateVisitorSession = async (req, overrides = {}) => {
  const config = await getCRMConfig();
  const trackingEnabled = Boolean(config.trackingEnabled);
  const requestedId = String(overrides.sessionId || getVisitorSessionIdFromRequest(req) || generateVisitorSessionId()).trim();

  if (!trackingEnabled) {
    return { trackingEnabled: false, session: null, sessionId: requestedId };
  }

  let session = await VisitorSession.findOne({ sessionId: requestedId });
  const payload = { ...extractTrackingPayload(req), ...overrides };
  const now = new Date();

  if (!session) {
    session = await VisitorSession.create({
      sessionId: requestedId,
      user: req.user?._id ?? overrides.user ?? null,
      source: payload.source || '',
      medium: payload.medium || '',
      campaign: payload.campaign || '',
      landingPage: payload.landingPage || '',
      referrer: payload.referrer || '',
      userAgent: payload.userAgent || '',
      ipHash: payload.ipHash || '',
      firstSeenAt: now,
      lastActivityAt: now
    });
  } else {
    session.lastActivityAt = now;
    if (!session.user && req.user?._id) {
      session.user = req.user._id;
    }
    ['source', 'medium', 'campaign', 'landingPage', 'referrer', 'userAgent', 'ipHash'].forEach(key => {
      if ((!session[key] || session[key] === '') && payload[key]) {
        session[key] = payload[key];
      }
    });
    await session.save();
  }

  return { trackingEnabled: true, session, sessionId: session.sessionId };
};

export const linkVisitorSessionToContact = async ({ session, sessionId, contactId, userId = null }) => {
  let targetSession = session;
  if (!targetSession && sessionId) {
    targetSession = await VisitorSession.findOne({ sessionId });
  }
  if (!targetSession) {
    return null;
  }

  let changed = false;
  if (contactId && (!targetSession.contact || targetSession.contact.toString() !== contactId.toString())) {
    targetSession.contact = contactId;
    changed = true;
  }
  if (userId && (!targetSession.user || targetSession.user.toString() !== userId.toString())) {
    targetSession.user = userId;
    changed = true;
  }
  targetSession.lastActivityAt = new Date();
  changed = true;

  if (changed) {
    await targetSession.save();
  }
  return targetSession;
};
