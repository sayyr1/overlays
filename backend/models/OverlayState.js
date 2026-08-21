import mongoose from 'mongoose';
const graphicSchema = new mongoose.Schema({
  id: String,
  type: String,
  data: mongoose.Schema.Types.Mixed,
  activatedAt: Date,
  expiresAt: Date,
  duration: Number
}, { _id: false });

const overlayStateSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', unique: true, required: true, index: true },
  revision: { type: Number, default: 0 }, scoreboardVisible: { type: Boolean, default: true },
  clockVisible: { type: Boolean, default: true }, channelBugVisible: { type: Boolean, default: false }, sponsorBugVisible: { type: Boolean, default: false },
  mainGraphic: { type: graphicSchema, default: null },
  temporaryGraphic: { type: graphicSchema, default: null },
  lowerThird: { type: graphicSchema, default: null },
  overlayLastSeenAt: { type: Date, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsAdmin' }
}, { timestamps: true });
export default mongoose.models.OverlayState || mongoose.model('OverlayState', overlayStateSchema);
