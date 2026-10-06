import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  computer: { type: String, unique: true, required: true },
  inputName: { type: String, default: 'BELABOX_SRT' },
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
  duckEnabled: { type: Boolean, default: false },
  ambientPercent: { type: Number, default: 15, min: 0, max: 100 },
  // Persist the baseline before lowering OBS so a backend restart can restore it.
  restoreVolume: { type: Number, default: null },
  appliedVolume: { type: Number, default: null },
}, { timestamps: true });
export default mongoose.models.ObsAudio || mongoose.model('ObsAudio', schema);
