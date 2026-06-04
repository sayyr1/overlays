import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    unique: true,
    default: 'default'
  },
  businessName: { type: String, trim: true, default: 'Niway Store' },
  tradeName: { type: String, trim: true, default: 'Niway Store' },
  country: { type: String, trim: true, default: 'Ecuador' },
  currency: { type: String, trim: true, default: 'USD' },
  timezone: { type: String, trim: true, default: 'America/Guayaquil' },
  contactEmail: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  whatsapp: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  socialLinks: {
    type: Map,
    of: String,
    default: () => new Map()
  },
  footerText: { type: String, trim: true, default: 'Todos los derechos reservados.' }
}, { timestamps: true });

export default mongoose.model('SystemSettings', systemSettingsSchema);
