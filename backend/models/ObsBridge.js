import mongoose from 'mongoose';

const command = new mongoose.Schema({ id: String, kind: { type: String, default: 'audio' }, action: String, clipId: String, tournamentId: String, name: String, branding: mongoose.Schema.Types.Mixed, inputName: String, muted: Boolean, volumePercent: Number, expiresAt: Date }, { _id: false });
const schema = new mongoose.Schema({
  key: { type: String, default: 'home', unique: true },
  tokenHash: { type: String, select: false },
  inputName: { type: String, default: 'BELABOX_SRT' },
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
  duckEnabled: { type: Boolean, default: false },
  ambientPercent: { type: Number, default: 15, min: 0, max: 100 },
  revision: { type: Number, default: 0 },
  commands: { type: [command], default: [] },
  heartbeatAt: Date,
  agentId: String,
  status: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
export default mongoose.models.ObsBridge || mongoose.model('ObsBridge', schema);
