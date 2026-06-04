import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  action: { type: String, required: true, trim: true },
  entity: { type: String, required: true, trim: true },
  entityId: { type: String, trim: true, default: '' },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  ip: { type: String, trim: true, default: '' },
  userAgent: { type: String, trim: true, default: '' }
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.model('AuditLog', auditLogSchema);
