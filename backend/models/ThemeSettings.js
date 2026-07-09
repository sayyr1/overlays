import mongoose from 'mongoose';

const themeSettingsSchema = new mongoose.Schema({
  scope: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    enum: ['storefront', 'admin', 'superadmin']
  },
  label: {
    type: String,
    trim: true,
    default: ''
  },
  primaryColor: {
    type: String,
    trim: true,
    default: '#78d64b'
  },
  accentColor: {
    type: String,
    trim: true,
    default: '#f97316'
  },
  backgroundColor: {
    type: String,
    trim: true,
    default: '#141414'
  },
  surfaceColor: {
    type: String,
    trim: true,
    default: '#1c1c1c'
  },
  textColor: {
    type: String,
    trim: true,
    default: '#f3f4f6'
  },
  headingColor: {
    type: String,
    trim: true,
    default: '#ffffff'
  },
  mutedColor: {
    type: String,
    trim: true,
    default: '#a1a1aa'
  },
  fontBody: {
    type: String,
    trim: true,
    default: 'Inter'
  },
  fontHeading: {
    type: String,
    trim: true,
    default: 'Playfair Display'
  },
  buttonStyle: {
    type: String,
    trim: true,
    enum: ['rounded', 'pill', 'sharp'],
    default: 'rounded'
  },
  panelStyle: {
    type: String,
    trim: true,
    enum: ['soft', 'solid', 'outline'],
    default: 'soft'
  },
  formStyle: {
    type: String,
    trim: true,
    enum: ['filled', 'outline', 'minimal'],
    default: 'filled'
  },
  navStyle: {
    type: String,
    trim: true,
    enum: ['solid', 'glass'],
    default: 'solid'
  }
}, { timestamps: true });

export default mongoose.model('ThemeSettings', themeSettingsSchema);
