import mongoose from 'mongoose';

const CRM_EVENT_TYPES = [
  'store_visited',
  'product_viewed',
  'whatsapp_clicked',
  'cart_created',
  'product_added_to_cart',
  'checkout_started',
  'phone_entered',
  'order_created',
  'order_paid',
  'cart_abandoned',
  'manual_contact_done',
  'follow_up_created',
  'stock_back_available',
  'product_interest_registered'
];

const crmEventSchema = new mongoose.Schema(
  {
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CRMContact',
      default: null,
      index: true
    },
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
    eventType: {
      type: String,
      enum: CRM_EVENT_TYPES,
      required: true,
      index: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true
    },
    cartSnapshot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CartSnapshot',
      default: null,
      index: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

crmEventSchema.index({ eventType: 1, createdAt: -1 });
crmEventSchema.index({ contact: 1, createdAt: -1 });
crmEventSchema.index({ session: 1, createdAt: -1 });

export { CRM_EVENT_TYPES };
export default mongoose.model('CRMEvent', crmEventSchema);
