import mongoose from 'mongoose';
const lineupSchema = new mongoose.Schema({ player: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsPlayer' }, starter: Boolean, captain: Boolean, goalkeeper: Boolean, position: String }, { _id: false });
const matchSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsTeam', required: true }, awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsTeam', required: true },
  scheduledAt: Date, stadium: { type: String, trim: true, maxlength: 120 }, round: { type: String, trim: true, maxlength: 60 },
  status: { type: String, enum: ['programado', 'en_vivo', 'descanso', 'suspendido', 'finalizado'], default: 'programado' },
  score: { home: { type: Number, default: 0, min: 0 }, away: { type: Number, default: 0, min: 0 }, penaltiesHome: { type: Number, default: 0, min: 0 }, penaltiesAway: { type: Number, default: 0, min: 0 } },
  discipline: { home: { yellowCards: { type: Number, default: 0, min: 0 }, redCards: { type: Number, default: 0, min: 0 } }, away: { yellowCards: { type: Number, default: 0, min: 0 }, redCards: { type: Number, default: 0, min: 0 } } },
  stats: {
    home: { possession: { type: Number, default: 50, min: 0, max: 100 }, shots: { type: Number, default: 0, min: 0 }, onTarget: { type: Number, default: 0, min: 0 }, corners: { type: Number, default: 0, min: 0 }, fouls: { type: Number, default: 0, min: 0 } },
    away: { possession: { type: Number, default: 50, min: 0, max: 100 }, shots: { type: Number, default: 0, min: 0 }, onTarget: { type: Number, default: 0, min: 0 }, corners: { type: Number, default: 0, min: 0 }, fouls: { type: Number, default: 0, min: 0 } }
  },
  officials: { referee: { type: String, default: '' }, assistants: { type: [String], default: [] } },
  broadcastTeam: { commentators: { type: [String], default: [] }, reporters: { type: [String], default: [] } },
  clock: { elapsedSeconds: { type: Number, default: 0, min: 0 }, startedAt: { type: Date, default: null }, running: { type: Boolean, default: false }, period: { type: String, default: 'Primer tiempo' }, addedTime: { type: Number, default: 0, min: 0 } },
  lineups: { home: { type: [lineupSchema], default: [] }, away: { type: [lineupSchema], default: [] } }
}, { timestamps: true });
matchSchema.pre('validate', function validateTeams() {
  if (this.homeTeam?.equals?.(this.awayTeam)) {
    throw new Error('El equipo local y visitante deben ser diferentes');
  }
});
export default mongoose.models.SportsMatch || mongoose.model('SportsMatch', matchSchema);
