import crypto from 'crypto';

export const normalizePhone = value =>
  String(value || '')
    .replace(/\D/g, '')
    .trim();

export const normalizeEmail = value =>
  String(value || '')
    .trim()
    .toLowerCase();

export const hashIp = value => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return crypto.createHash('sha256').update(raw).digest('hex');
};

export const uniqueObjectIds = values =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .filter(Boolean)
        .map(value => value.toString())
    )
  );

export const sanitizeTags = tags =>
  Array.from(
    new Set(
      (Array.isArray(tags) ? tags : [tags])
        .map(tag => String(tag || '').trim())
        .filter(Boolean)
    )
  );

export const getVisitorSessionIdFromRequest = req =>
  String(
    req.headers['x-visitor-session-id'] ||
      req.cookies?.visitor_session_id ||
      req.body?.sessionId ||
      req.query?.sessionId ||
      ''
  ).trim();
