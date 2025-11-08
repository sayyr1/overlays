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

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: Number, unique: true, required: true },
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
    enum: ['Hombre', 'Mujer', 'Ni��o', 'Ni��a', 'Unisex'],
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
  lastSoldAt: { type: Date },
  images: [{
    url: { type: String, required: true },
    public_id: { type: String, required: true }
  }],
  onSale: { type: Boolean, default: false }
}, {
  timestamps: true
});

export default mongoose.model('Product', productSchema);

