import mongoose from 'mongoose';

const crmConfigSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: 'default',
      unique: true
    },
    abandonedCartHours: {
      type: Number,
      default: 4,
      min: 1
    },
    recentEntryHours: {
      type: Number,
      default: 36,
      min: 1
    },
    newCustomerHighlightDays: {
      type: Number,
      default: 7,
      min: 1
    },
    activeStatuses: {
      type: [String],
      default: () => [
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
      ]
    },
    availableTags: {
      type: [String],
      default: () => [
        'frequent_customer',
        'vip',
        'cart_abandoned',
        'post_sale',
        'interested',
        'reactivation'
      ]
    },
    suggestedMessages: {
      type: Map,
      of: String,
      default: () => new Map()
    },
    postSaleFollowUpDays: {
      type: Number,
      default: 3,
      min: 1
    },
    inactiveCustomerDays: {
      type: Number,
      default: 45,
      min: 1
    },
    vipSpendThreshold: {
      type: Number,
      default: 250,
      min: 0
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0
    },
    frequentCustomerOrdersThreshold: {
      type: Number,
      default: 3,
      min: 1
    },
    trackingEnabled: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('CRMConfig', crmConfigSchema);
