import mongoose from 'mongoose';
const eventSchema = new mongoose.Schema({
  match: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsMatch', required: true, index: true }, tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsTeam' }, player: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsPlayer' }, playerIn: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsPlayer' }, playerOut: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsPlayer' },
  type: { type: String, required: true }, minute: Number, period: String, data: mongoose.Schema.Types.Mixed, previousState: mongoose.Schema.Types.Mixed,
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'SportsAdmin' }, reversible: { type: Boolean, default: true }, undoneAt: Date
}, { timestamps: true });
export default mongoose.models.SportsEvent || mongoose.model('SportsEvent', eventSchema);
