import mongoose from 'mongoose';

const paymentMethodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true, default: 'other' },
  enabled: { type: Boolean, default: true },
  instructions: { type: String, trim: true, default: '' },
  bankName: { type: String, trim: true, default: '' },
  accountNumber: { type: String, trim: true, default: '' },
  accountOwner: { type: String, trim: true, default: '' },
  accountId: { type: String, trim: true, default: '' },
  accountType: { type: String, trim: true, default: '' },
  whatsappNumber: { type: String, trim: true, default: '' },
  displayOrder: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('PaymentMethod', paymentMethodSchema);
