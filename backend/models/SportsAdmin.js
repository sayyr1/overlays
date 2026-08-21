import mongoose from 'mongoose';

const sportsAdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  passwordHash: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.models.SportsAdmin || mongoose.model('SportsAdmin', sportsAdminSchema);
