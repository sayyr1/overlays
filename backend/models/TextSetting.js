import mongoose from 'mongoose';

const textSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  label: { type: String, required: true, trim: true },
  value: { type: String, trim: true, default: '' },
  group: { type: String, trim: true, default: 'general' },
  description: { type: String, trim: true, default: '' }
}, { timestamps: true });

export default mongoose.model('TextSetting', textSettingSchema);
