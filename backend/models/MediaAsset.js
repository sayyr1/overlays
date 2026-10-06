import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 90 },
  category: { type: String, enum: ['images', 'videos', 'motion', 'logos', 'sponsors', 'backgrounds'], required: true },
  kind: { type: String, enum: ['image', 'video'], required: true },
  publicId: { type: String, required: true, unique: true },
  secureUrl: { type: String, required: true },
  format: String, width: Number, height: Number, duration: Number, bytes: Number,
}, { timestamps: true });
export default mongoose.models.MediaAsset || mongoose.model('MediaAsset', schema);
