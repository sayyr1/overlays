import mongoose from 'mongoose';
const mediaSchema = new mongoose.Schema({ publicId: String, secureUrl: String, width: Number, height: Number, format: String }, { _id: false });
const playerSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsTeam', required: true, index: true },
  fullName: { type: String, required: true, trim: true, maxlength: 120 }, sportsName: { type: String, trim: true, maxlength: 60 },
  number: { type: Number, min: 0, max: 99 }, position: { type: String, trim: true, maxlength: 40 }, photo: mediaSchema,
  starter: { type: Boolean, default: false }, captain: { type: Boolean, default: false }, goalkeeper: { type: Boolean, default: false }, active: { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.models.SportsPlayer || mongoose.model('SportsPlayer', playerSchema);
