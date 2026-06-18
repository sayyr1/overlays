import mongoose from 'mongoose';

const priceSchema = new mongoose.Schema({
  retail: { type: Number, required: true, min: 0 },
  gold: {
    type: Number,
    required: true,
    min: 0,
    default: function setGoldDefault() {
      return this.retail ?? 0;
    }
  },
  premium: {
    type: Number,
    required: true,
    min: 0,
    default: function setPremiumDefault() {
      return this.retail ?? 0;
    }
  },
  platinum: {
    type: Number,
    required: true,
    min: 0,
    default: function setPlatinumDefault() {
      return this.retail ?? 0;
    }
  }
}, { _id: false });

const saleHistorySchema = new mongoose.Schema({
  soldAt: {
    type: Date,
    default: Date.now
  },
  color: {
    type: String,
    trim: true,
    default: ''
  },
  size: {
    type: String,
    trim: true,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  priceSource: {
    type: String,
    enum: ['retail', 'manual'],
    default: 'retail'
  }
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true, required: true, trim: true },
  price: { type: priceSchema, required: true },
  description: String,
  brand: String,
  type: String,
  collection: {
    type: String,
    trim: true,
    default: ''
  },
  gender: {
    type: String,
    enum: ['Hombre', 'Mujer', 'Nino', 'Nina', 'Unisex'],
    default: 'Unisex'
  },
  // Dynamic attributes for additional category keys (e.g., ORIGEN, MATERIAL, etc.)
  attributes: {
    type: Map,
    of: String,
    default: () => new Map()
  },
  colors: [{
    type: String,
    trim: true
  }],
  stockBySize: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  stockByColorSize: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  soldBySize: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  soldByColorSize: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  reservedBySize: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  reservedByColorSize: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  saleHistory: {
    type: [saleHistorySchema],
    default: () => []
  },
  lastSoldAt: { type: Date },
  images: [{
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    visibility: {
      type: String,
      enum: ['public', 'internal'],
      default: 'public'
    }
  }],
  storeVisibility: {
    type: String,
    enum: ['public', 'internal'],
    default: 'internal'
  },
  onSale: { type: Boolean, default: false }
}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

export default mongoose.model('Product', productSchema);
