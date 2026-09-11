import mongoose from 'mongoose';
import { broadcastModes, broadcastTypes } from '../services/broadcastConfig.js';

const mediaSchema = new mongoose.Schema({
  publicId: String, secureUrl: String, width: Number, height: Number, format: String
}, { _id: false });

const tournamentSchema = new mongoose.Schema({
  mode: { type: String, enum: broadcastModes, default: 'sports' },
  broadcast: {
    scenes: { type: [new mongoose.Schema({
      id: { type: String, required: true, maxlength: 80 },
      type: { type: String, required: true, enum: broadcastTypes },
      label: { type: String, required: true, maxlength: 60 },
      title: { type: String, default: '', maxlength: 100 },
      subtitle: { type: String, default: '', maxlength: 180 },
      seconds: { type: Number, default: 300, min: 1, max: 3600 },
      duration: { type: Number, default: 0, min: 0, max: 3600 },
    }, { _id: false })], default: [], validate: { validator: scenes => scenes.length <= 30 && new Set(scenes.map(s => s.id)).size === scenes.length, message: 'Máximo 30 gráficos con identificadores únicos.' } },
  },
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
