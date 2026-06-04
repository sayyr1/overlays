import mongoose from 'mongoose';

const CRM_TASK_TYPES = [
  'follow_up',
  'abandoned_cart',
  'post_sale',
  'stock_alert',
  'reactivation',
  'manual_whatsapp'
];

const CRM_TASK_STATUSES = ['pending', 'done', 'cancelled', 'overdue'];
const CRM_TASK_PRIORITIES = ['low', 'medium', 'high'];

const crmTaskSchema = new mongoose.Schema(
  {
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CRMContact',
      required: true,
      index: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    type: {
      type: String,
      enum: CRM_TASK_TYPES,
      required: true,
      index: true
    },
    dueDate: {
      type: Date,
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: CRM_TASK_STATUSES,
      default: 'pending',
      index: true
    },
    priority: {
      type: String,
      enum: CRM_TASK_PRIORITIES,
      default: 'medium'
    },
    relatedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    relatedCartSnapshot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CartSnapshot',
      default: null
    },
    suggestedMessage: {
      type: String,
      trim: true,
      default: ''
    },
    completedAt: {
      type: Date,
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

crmTaskSchema.index({ status: 1, dueDate: 1 });

export { CRM_TASK_TYPES, CRM_TASK_STATUSES, CRM_TASK_PRIORITIES };
export default mongoose.model('CRMTask', crmTaskSchema);
