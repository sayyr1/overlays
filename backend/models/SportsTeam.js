import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema({ publicId: String, secureUrl: String, width: Number, height: Number, format: String }, { _id: false });
const teamSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  shortName: { type: String, required: true, trim: true, maxlength: 24 },
  code: { type: String, required: true, uppercase: true, trim: true, minlength: 3, maxlength: 3 },
  crest: mediaSchema, city: { type: String, trim: true, maxlength: 80 }, coach: { type: String, trim: true, maxlength: 100 },
  primaryColor: { type: String, default: '#123B6D' }, secondaryColor: { type: String, default: '#FFFFFF' }, active: { type: Boolean, default: true }
}, { timestamps: true });
teamSchema.index({ tournament: 1, code: 1 }, { unique: true });
export default mongoose.models.SportsTeam || mongoose.model('SportsTeam', teamSchema);
