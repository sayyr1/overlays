import AuditLog from '../models/AuditLog.js';

const toSerializable = value => {
  if (value == null) return null;
  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, flattenMaps: true });
  }
  return JSON.parse(JSON.stringify(value));
};

export const createAuditLog = async (req, payload) => {
  const document = {
    user: req.user?._id ?? null,
    action: payload.action,
    entity: payload.entity,
    entityId: payload.entityId?.toString?.() || '',
    before: toSerializable(payload.before),
    after: toSerializable(payload.after),
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.get('user-agent') || ''
  };

  return AuditLog.create(document);
};
