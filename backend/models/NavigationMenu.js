import mongoose from 'mongoose';

const menuLinkSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true, trim: true },
  kind: {
    type: String,
    enum: ['link', 'collection', 'category', 'filter'],
    default: 'link'
  },
  href: {
    type: String,
    trim: true,
    default: ''
  },
  badge: {
    type: String,
    trim: true,
    default: ''
  },
  settings: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  megaMenu: {
    columns: {
      type: [{
        id: { type: String, required: true },
        title: { type: String, trim: true, default: '' },
        order: { type: Number, default: 0 },
        items: [{
          id: { type: String, required: true },
          label: { type: String, required: true, trim: true },
          href: { type: String, required: true, trim: true },
          badge: { type: String, trim: true, default: '' },
          order: { type: Number, default: 0 }
        }]
      }],
      default: []
    },
    featured: {
      type: {
        title: { type: String, trim: true, default: '' },
        description: { type: String, trim: true, default: '' },
        href: { type: String, trim: true, default: '' },
        imageUrl: { type: String, trim: true, default: '' }
      },
      default: null
    }
  },
  order: { type: Number, default: 0 }
}, { _id: false });

const menuRowSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, trim: true, default: '' },
  type: {
    type: String,
    enum: ['highlight', 'category'],
    default: 'highlight'
  },
  items: [menuLinkSchema],
  order: { type: Number, default: 0 }
}, { _id: false });

const navigationMenuSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  title: {
    type: String,
    trim: true,
    default: ''
  },
  rows: {
    type: [menuRowSchema],
    default: []
  },
  settings: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

export default mongoose.model('NavigationMenu', navigationMenuSchema);
