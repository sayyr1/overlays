import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    match: /^\S+@\S+\.\S+$/
  },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  membershipLevel: {
    type: String,
    enum: ['STANDARD', 'GOLD', 'PREMIUM', 'PLATINUM'],
    default: 'STANDARD'
  }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
