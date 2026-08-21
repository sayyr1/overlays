import crypto from 'crypto';
import Tournament from '../models/Tournament.js';
import SportsMatch from '../models/SportsMatch.js';
import OverlayState from '../models/OverlayState.js';
import Sponsor from '../models/Sponsor.js';
import { publishOverlayState } from './sportsRealtime.js';

export const hashOverlayToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');
export const issueOverlayToken = () => crypto.randomBytes(32).toString('base64url');

export const findTournamentByOverlayToken = async (slug, token) => {
  if (!token || token.length < 32) return null;
  return Tournament.findOne({ slug: String(slug).toLowerCase(), overlayTokenHash: hashOverlayToken(token), active: true }).select('+overlayTokenHash');
};
export const findTournamentByRemoteToken = async (slug, token) => {
  if (!token || token.length < 32) return null;
  return Tournament.findOne({ slug: String(slug).toLowerCase(), remoteTokenHash: hashOverlayToken(token), active: true }).select('+remoteTokenHash');
};

const serializeTeam = team => team && ({ id: team._id, name: team.name, shortName: team.shortName, code: team.code, crest: team.crest, primaryColor: team.primaryColor, secondaryColor: team.secondaryColor });
export const getOverlaySnapshot = async tournamentId => {
  const tournament = await Tournament.findById(tournamentId).populate('activeMatch');
  if (!tournament) return null;
  const state = await OverlayState.findOneAndUpdate({ tournament: tournament._id }, { $setOnInsert: { tournament: tournament._id } }, { upsert: true, new: true });
  const sponsors = await Sponsor.find({ tournament: tournament._id, active: true }).sort({ order: 1, createdAt: 1 }).lean();
  let match = null;
  if (tournament.activeMatch) match = await SportsMatch.findById(tournament.activeMatch).populate(['homeTeam', 'awayTeam', 'lineups.home.player', 'lineups.away.player']).lean();
  const activeGraphic = graphic => graphic?.expiresAt && new Date(graphic.expiresAt).getTime() <= Date.now() ? null : graphic;
  return {
    tournamentId: String(tournament._id), revision: state.revision, generatedAt: new Date().toISOString(),
    overlayLastSeenAt: state.overlayLastSeenAt,
    tournament: { id: tournament._id, name: tournament.name, season: tournament.season, logo: tournament.logo, colors: tournament.colors, branding: tournament.branding, slug: tournament.slug },
    match: match && { id: match._id, status: match.status, stadium: match.stadium, round: match.round, scheduledAt: match.scheduledAt, score: match.score, discipline: match.discipline, stats: match.stats, lineups: match.lineups, officials: match.officials, broadcastTeam: match.broadcastTeam, clock: match.clock, homeTeam: serializeTeam(match.homeTeam), awayTeam: serializeTeam(match.awayTeam) },
    sponsors: sponsors.map(sponsor => ({ id: String(sponsor._id), name: sponsor.name, headline: sponsor.headline, description: sponsor.description, location: sponsor.location, phone: sponsor.phone, url: sponsor.url, category: sponsor.category, backgroundColor: sponsor.backgroundColor, textColor: sponsor.textColor, accentColor: sponsor.accentColor, durationSeconds: sponsor.durationSeconds, logo: sponsor.logo })),
    graphics: { scoreboardVisible: state.scoreboardVisible, clockVisible: state.clockVisible, channelBugVisible: state.channelBugVisible, sponsorBugVisible: state.sponsorBugVisible, main: activeGraphic(state.mainGraphic), temporary: activeGraphic(state.temporaryGraphic), lowerThird: activeGraphic(state.lowerThird) }
  };
};

export const updateOverlayState = async (tournamentId, changes, actorId) => {
  const state = await OverlayState.findOneAndUpdate(
    { tournament: tournamentId }, { $set: { ...changes, updatedBy: actorId }, $inc: { revision: 1 }, $setOnInsert: { tournament: tournamentId } }, { upsert: true, new: true }
  );
  const snapshot = await getOverlaySnapshot(tournamentId);
  await publishOverlayState(snapshot).catch(error => console.error('No se pudo publicar estado de overlay:', error.message));
  return { state, snapshot };
};

export const recordOverlayHeartbeat = tournamentId => OverlayState.findOneAndUpdate(
  { tournament: tournamentId },
  { $set: { overlayLastSeenAt: new Date() }, $setOnInsert: { tournament: tournamentId } },
  { upsert: true, new: true }
);
