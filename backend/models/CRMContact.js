import mongoose from 'mongoose';

const CRM_STATUSES = [
  'visitor',
  'new_lead',
  'contacted',
  'link_sent',
  'interested',
  'cart_abandoned',
  'customer',
  'vip',
  'inactive',
  'lost'
];

const crmContactSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    name: {
      type: String,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    phoneNormalized: {
      type: String,
      trim: true,
      default: ''
    },
    whatsapp: {
      type: String,
      trim: true,
      default: ''
    },
    whatsappNormalized: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    emailNormalized: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    leadCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    leadCodeHistory: {
      type: [String],
      default: []
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
    status: {
      type: String,
      enum: CRM_STATUSES,
      default: 'visitor',
      index: true
    },
    tags: {
      type: [String],
      default: []
    },
    firstSeenAt: {
      type: Date,
      default: Date.now
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastPurchasedAt: {
      type: Date,
      default: null
    },
    lastContactedAt: {
      type: Date,
      default: null
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: 0
    },
    ordersCount: {
      type: Number,
      default: 0,
      min: 0
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    interestedProducts: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Product',
      default: []
    }
  },
  { timestamps: true }
);

crmContactSchema.index(
  { phoneNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { phoneNormalized: { $type: 'string', $ne: '' } }
  }
);

crmContactSchema.index(
  { emailNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { emailNormalized: { $type: 'string', $ne: '' } }
  }
);

crmContactSchema.index(
  { leadCode: 1 },
  {
    unique: true,
    partialFilterExpression: { leadCode: { $type: 'string', $ne: '' } }
  }
);

crmContactSchema.index({ status: 1, updatedAt: -1 });
crmContactSchema.index({ owner: 1, status: 1, updatedAt: -1 });

export { CRM_STATUSES };
export default mongoose.model('CRMContact', crmContactSchema);
