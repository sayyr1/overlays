import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema({
  publicId: String, secureUrl: String, width: Number, height: Number, format: String
}, { _id: false });

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  season: { type: String, trim: true, maxlength: 60 },
  startDate: Date,
  endDate: Date,
  logo: mediaSchema,
  active: { type: Boolean, default: true },
  colors: {
    primary: { type: String, default: '#0B2E59' }, secondary: { type: String, default: '#FFFFFF' },
    accent: { type: String, default: '#F2B705' }, text: { type: String, default: '#FFFFFF' },
    background: { type: String, default: '#071727' }
  },
  branding: {
    imbaburaLogo: mediaSchema, codebriqLogo: mediaSchema, sponsorLogo: mediaSchema,
    sponsorName: { type: String, default: '' }, showImbabura: { type: Boolean, default: true },
    showCodebriq: { type: Boolean, default: true }, showSponsor: { type: Boolean, default: false }
  },
  activeMatch: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsMatch', default: null },
  overlayTokenHash: { type: String, select: false },
  overlayTokenPrefix: { type: String, default: '' },
  remoteTokenHash: { type: String, select: false },
  remoteTokenPrefix: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.models.Tournament || mongoose.model('Tournament', tournamentSchema);
