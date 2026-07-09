import mongoose from 'mongoose';

const homeSectionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['hero', 'new_arrivals', 'featured_products', 'categories', 'brands', 'collections', 'origins']
  },
  enabled: {
    type: Boolean,
    default: true
  },
  title: {
    type: String,
    trim: true,
    default: ''
  },
  eyebrow: {
    type: String,
    trim: true,
    default: ''
  },
  linkTo: {
    type: String,
    trim: true,
    default: ''
  },
  linkLabel: {
    type: String,
    trim: true,
    default: ''
  },
  limit: {
    type: Number,
    default: 6
  },
  order: {
    type: Number,
    default: 0
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

const homeLayoutSettingsSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    unique: true,
    default: 'default'
  },
  sections: {
    type: [homeSectionSchema],
    default: []
  }
}, { timestamps: true });

export default mongoose.model('HomeLayoutSettings', homeLayoutSettingsSchema);
