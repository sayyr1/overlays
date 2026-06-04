import mongoose from 'mongoose';

const visitorSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
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
      default: null,
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
    landingPage: {
      type: String,
      trim: true,
      default: ''
    },
    referrer: {
      type: String,
      trim: true,
      default: ''
    },
    userAgent: {
      type: String,
      trim: true,
      default: ''
    },
    ipHash: {
      type: String,
      trim: true,
      default: ''
    },
    firstSeenAt: {
      type: Date,
      default: Date.now
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('VisitorSession', visitorSessionSchema);
