import mongoose from 'mongoose';

const customerNoteSchema = new mongoose.Schema(
  {
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CRMContact',
      required: true,
      index: true
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    note: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('CustomerNote', customerNoteSchema);
