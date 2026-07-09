import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    unique: true,
    default: 'default'
  },
  businessName: { type: String, trim: true, default: 'Tu negocio' },
  tradeName: { type: String, trim: true, default: 'Tu tienda' },
  country: { type: String, trim: true, default: 'Ecuador' },
  currency: { type: String, trim: true, default: 'USD' },
  timezone: { type: String, trim: true, default: 'America/Guayaquil' },
  contactEmail: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  whatsapp: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  catalogProfile: {
    type: String,
    trim: true,
    enum: ['footwear', 'apparel', 'custom'],
    default: 'footwear'
  },
  catalogProfileLabel: { type: String, trim: true, default: 'Zapatos' },
  socialLinks: {
    type: Map,
    of: String,
    default: () => new Map()
  },
  footerText: { type: String, trim: true, default: 'Todos los derechos reservados.' },
  enableInternalProductImages: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('SystemSettings', systemSettingsSchema);
