import mongoose from 'mongoose';

const brandingSettingsSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    unique: true,
    default: 'default'
  },
  logoUrl: { type: String, trim: true, default: '' },
  faviconUrl: { type: String, trim: true, default: '' },
  navbarName: { type: String, trim: true, default: 'Tu tienda' },
  primaryColor: { type: String, trim: true, default: '#0f766e' },
  secondaryColor: { type: String, trim: true, default: '#111827' },
  backgroundColor: { type: String, trim: true, default: '#0b1220' },
  textColor: { type: String, trim: true, default: '#0f172a' },
  visualStyle: { type: String, trim: true, default: 'default' }
}, { timestamps: true });

export default mongoose.model('BrandingSettings', brandingSettingsSchema);
