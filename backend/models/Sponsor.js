import mongoose from 'mongoose';
const mediaSchema = new mongoose.Schema({ publicId: String, secureUrl: String, width: Number, height: Number, format: String }, { _id: false });
const sponsorSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 90 },
  headline: { type: String, trim: true, maxlength: 150, default: '' },
  description: { type: String, trim: true, maxlength: 260, default: '' },
  location: { type: String, trim: true, maxlength: 180, default: '' },
  phone: { type: String, trim: true, maxlength: 80, default: '' },
  url: { type: String, trim: true, maxlength: 180, default: '' },
  category: { type: String, trim: true, maxlength: 60, default: '' },
  backgroundColor: { type: String, default: '#101720', match: /^#[0-9a-fA-F]{6}$/ },
  textColor: { type: String, default: '#FFFFFF', match: /^#[0-9a-fA-F]{6}$/ },
  accentColor: { type: String, default: '#E0B84D', match: /^#[0-9a-fA-F]{6}$/ },
  durationSeconds: { type: Number, min: 3, max: 120, default: 10 },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  primary: { type: Boolean, default: false },
  showBug: { type: Boolean, default: false },
  logo: mediaSchema
}, { timestamps: true });
export default mongoose.models.Sponsor || mongoose.model('Sponsor', sponsorSchema);
