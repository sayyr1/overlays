import mongoose from 'mongoose';
import crypto from 'crypto';
import Counter from './Counter.js';
import { ORDER_HOLD_WINDOW_MS } from '../constants/orderConfig.js';

const statusEnum = [
  'PENDIENTE_PAGO',
  'PAGADO',
  'EN_PREPARACION',
  'ENVIADO',
  'ENTREGADO',
  'CANCELADO',
  'EXPIRADO'
];

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  size: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    trim: true,
    default: ''
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
  title: {
    type: String,
    required: true,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true,
    default: ''
  }
}, { _id: false });

const totalsSchema = new mongoose.Schema({
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  count: {
    type: Number,
    default: 0,
    min: 0
  },
  items: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: statusEnum,
    required: true
  },
  note: {
    type: String,
    trim: true,
    default: ''
  },
  changedAt: {
    type: Date,
    default: Date.now
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: Number,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  crmContact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CRMContact',
    default: null,
    index: true
  },
  cartSnapshot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CartSnapshot',
    default: null
  },
  visitorSessionId: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  lookupToken: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    index: true
  },
  items: {
    type: [orderItemSchema],
    validate: [items => items.length > 0, 'El pedido debe contener productos']
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  totals: {
    type: totalsSchema,
    default: () => ({ subtotal: 0, count: 0, items: 0 })
  },
  status: {
    type: String,
    enum: statusEnum,
    default: 'PENDIENTE_PAGO'
  },
  contactName: {
    type: String,
    trim: true,
    default: ''
  },
  contactPhone: {
    type: String,
    trim: true,
    default: ''
  },
  contactEmail: {
    type: String,
    trim: true,
    default: ''
  },
  contactAddress: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  expiresAt: {
    type: Date,
    required: true
  },
  confirmedAt: Date,
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  paymentReference: {
    type: String,
    trim: true,
    default: ''
  },
  processingAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  statusHistory: {
    type: [statusHistorySchema],
    default: () => []
  }
}, {
  timestamps: true
});

orderSchema.pre('validate', function preValidate() {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + ORDER_HOLD_WINDOW_MS);
  }
  if (this.total == null) {
    this.total = this.subtotal;
  }
  if (!this.totals) {
    this.totals = { subtotal: this.subtotal, count: 0, items: 0 };
  } else {
    this.totals.subtotal = this.subtotal;
    if (this.totals.count == null) {
      this.totals.count = 0;
    }
    if (this.totals.items == null) {
      this.totals.items = this.items?.length ?? 0;
    }
  }
});

orderSchema.pre('save', function assignLookupToken() {
  if (!this.isNew || this.lookupToken) {
    return;
  }

  this.lookupToken = crypto.randomBytes(18).toString('hex');
});

orderSchema.pre('save', async function assignOrderNumber() {
  if (!this.isNew || this.orderNumber) {
    return;
  }

  const counter = await Counter.findOneAndUpdate(
    { name: 'orders' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  this.orderNumber = counter.seq;
});

export default mongoose.model('Order', orderSchema);

