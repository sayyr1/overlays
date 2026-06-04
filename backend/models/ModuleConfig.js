import mongoose from 'mongoose';

const moduleConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  label: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  enabled: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['active', 'inactive', 'coming_soon'],
    default: 'active'
  },
  order: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('ModuleConfig', moduleConfigSchema);
