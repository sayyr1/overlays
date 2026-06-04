import mongoose from 'mongoose';

const cartSnapshotItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    title: {
      type: String,
      trim: true,
      default: ''
    },
    size: {
      type: String,
      trim: true,
      default: ''
    },
    color: {
      type: String,
      trim: true,
      default: ''
    },
    quantity: {
      type: Number,
      min: 1,
      default: 1
    },
    unitPrice: {
      type: Number,
      min: 0,
      default: 0
    },
    imageUrl: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const cartSnapshotSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VisitorSession',
      default: null,
      index: true
    },
    sessionId: {
      type: String,
      trim: true,
      default: '',
      index: true
    },
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CRMContact',
      default: null,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true
    },
    items: {
      type: [cartSnapshotItemSchema],
      default: []
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0
    },
    itemsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    quantityCount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['active', 'checkout_started', 'abandoned', 'contacted', 'recovered', 'converted', 'discarded'],
      default: 'active',
      index: true
    },
    source: {
      type: String,
      trim: true,
      default: ''
    },
    medium: {
      type: String,
      trim: true,
      default: ''
    },
    campaign: {
      type: String,
      trim: true,
      default: ''
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
    suggestedMessage: {
      type: String,
      trim: true,
      default: ''
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    checkoutStartedAt: {
      type: Date,
      default: null
    },
    abandonedAt: {
      type: Date,
      default: null
    },
    contactedAt: {
      type: Date,
      default: null
    },
    recoveredAt: {
      type: Date,
      default: null
    },
    discardedAt: {
      type: Date,
      default: null
    },
    convertedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

cartSnapshotSchema.index({ status: 1, lastActivityAt: 1 });

export default mongoose.model('CartSnapshot', cartSnapshotSchema);
