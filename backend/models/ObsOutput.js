import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  key: { type: String, default: 'program', unique: true },
  // Admin-only retrieval makes copying idempotent; the public route checks a hash.
  token: { type: String, select: false },
  tokenHash: { type: String, select: false },
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
  revision: { type: Number, default: 0 },
  lastSeenAt: Date,
  seenRevision: { type: Number, default: -1 },
  seenStateRevision: { type: Number, default: -1 },
}, { timestamps: true });
export default mongoose.models.ObsOutput || mongoose.model('ObsOutput', schema);
