import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, trim: true, required: true, maxlength: 90 },
  assetId: { type: String, required: true },
  config: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });
export default mongoose.models.MediaPreset || mongoose.model('MediaPreset', schema);
