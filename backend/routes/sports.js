import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import cloudinary from '../utils/cloudinary.js';
import SportsAdmin from '../models/SportsAdmin.js';
import Tournament from '../models/Tournament.js';
import SportsTeam from '../models/SportsTeam.js';
import SportsPlayer from '../models/SportsPlayer.js';
import SportsMatch from '../models/SportsMatch.js';
import SportsEvent from '../models/SportsEvent.js';
import OverlayState from '../models/OverlayState.js';
import Sponsor from '../models/Sponsor.js';
import { requireSportsAdmin, createSportsSession, sportsCookieOptions } from '../middleware/sportsAuth.js';
import { currentElapsedSeconds, pauseClock, startClock } from '../services/sportsClock.js';
import { authenticateOverlayChannel, overlayChannel } from '../services/sportsRealtime.js';
import { findTournamentByOverlayToken, findTournamentByRemoteToken, getOverlaySnapshot, hashOverlayToken, issueOverlayToken, recordOverlayHeartbeat, updateOverlayState } from '../services/overlayStateService.js';
import { runMatchControl } from '../services/matchControlService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, files: 1 }, { });
const validImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const loginAttempts = new Map();
const safeId = value => /^[a-f\d]{24}$/i.test(String(value || ''));
const slugify = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const pick = (body, fields) => Object.fromEntries(fields.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
const invalidId = (res, id) => !safeId(id) && res.status(400).json({ message: 'Identificador no válido.' });
const requireText = (value, label) => { if (!String(value || '').trim()) throw new Error(`${label} es obligatorio.`); };
const cookie = (res, token) => res.cookie('sports_session', token, sportsCookieOptions);
const adminView = admin => ({ id: admin._id, name: admin.name, email: admin.email });
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const remoteActions = new Set(['goal_home', 'goal_away', 'score_manual', 'clock_start', 'clock_pause', 'clock_add', 'period', 'added_time', 'stats', 'discipline', 'graphic', 'hide_graphic', 'clear_graphics', 'hide_all', 'scoreboard', 'layer', 'preset', 'yellow_card', 'red_card', 'var', 'injury', 'penalty_missed']);

router.post('/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const record = loginAttempts.get(email) || { count: 0, until: 0 };
  if (record.until > Date.now()) return res.status(429).json({ message: 'Demasiados intentos. Intenta nuevamente en unos minutos.' });
  const admin = await SportsAdmin.findOne({ email });
  if (!admin || !await bcrypt.compare(password, admin.passwordHash)) {
    record.count += 1; record.until = record.count >= 5 ? Date.now() + 15 * 60 * 1000 : 0; loginAttempts.set(email, record);
    return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
  }
  loginAttempts.delete(email); cookie(res, createSportsSession(admin)); return res.json({ admin: adminView(admin) });
}));
router.post('/auth/logout', (req, res) => { res.clearCookie('sports_session', { ...sportsCookieOptions, maxAge: undefined }); res.status(204).end(); });
router.get('/auth/me', requireSportsAdmin, (req, res) => res.json({ admin: adminView(req.sportsAdmin) }));

router.get('/tournaments', requireSportsAdmin, asyncRoute(async (req, res) => res.json(await Tournament.find().sort({ createdAt: -1 }).populate('activeMatch'))));
router.post('/tournaments', requireSportsAdmin, asyncRoute(async (req, res) => {
  requireText(req.body?.name, 'El nombre'); const slug = slugify(req.body?.slug || req.body?.name); requireText(slug, 'El slug');
  const token = issueOverlayToken();
  const tournament = await Tournament.create({ ...pick(req.body || {}, ['name', 'season', 'startDate', 'endDate', 'logo', 'active', 'colors', 'branding']), slug, overlayTokenHash: hashOverlayToken(token), overlayTokenPrefix: token.slice(0, 8) });
  await OverlayState.create({ tournament: tournament._id });
  res.status(201).json({ tournament, overlayToken: token, overlayUrl: `/overlay/torneo/${slug}?token=${token}` });
}));
router.get('/tournaments/:id', requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id)) return; const tournament = await Tournament.findById(req.params.id).populate('activeMatch'); if (!tournament) return res.status(404).json({ message: 'Torneo no encontrado.' }); res.json(tournament); }));
router.get('/tournaments/:id/overlay-state', requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id)) return; const snapshot = await getOverlaySnapshot(req.params.id); if (!snapshot) return res.status(404).json({ message: 'Torneo no encontrado.' }); res.json(snapshot); }));
router.put('/tournaments/:id', requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id)) return; const values = pick(req.body || {}, ['name', 'season', 'startDate', 'endDate', 'logo', 'active', 'colors', 'branding', 'activeMatch']); if (req.body?.slug) values.slug = slugify(req.body.slug); const tournament = await Tournament.findByIdAndUpdate(req.params.id, values, { new: true, runValidators: true }); if (!tournament) return res.status(404).json({ message: 'Torneo no encontrado.' }); await updateOverlayState(tournament._id, {}, req.sportsAdmin._id); res.json(tournament); }));
router.post('/tournaments/:id/overlay-token', requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id)) return; const token = issueOverlayToken(); const tournament = await Tournament.findByIdAndUpdate(req.params.id, { overlayTokenHash: hashOverlayToken(token), overlayTokenPrefix: token.slice(0, 8) }, { new: true }); if (!tournament) return res.status(404).json({ message: 'Torneo no encontrado.' }); res.json({ overlayToken: token, overlayUrl: `/overlay/torneo/${tournament.slug}?token=${token}` }); }));
router.post('/tournaments/:id/remote-token', requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id)) return; const token = issueOverlayToken(); const tournament = await Tournament.findByIdAndUpdate(req.params.id, { remoteTokenHash: hashOverlayToken(token), remoteTokenPrefix: token.slice(0, 8) }, { new: true }); if (!tournament) return res.status(404).json({ message: 'Torneo no encontrado.' }); res.json({ remoteToken: token, remoteUrl: `/control-remoto/${tournament.slug}?token=${token}` }); }));
router.post('/tournaments/:id/active-match', requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id) || invalidId(res, req.body?.matchId)) return; const match = await SportsMatch.findOne({ _id: req.body.matchId, tournament: req.params.id }); if (!match) return res.status(404).json({ message: 'El partido no pertenece al torneo.' }); const tournament = await Tournament.findByIdAndUpdate(req.params.id, { activeMatch: match._id }, { new: true }); await updateOverlayState(tournament._id, {}, req.sportsAdmin._id); res.json(tournament); }));

const crud = (basePath, Model, fields, filter = () => ({}), onChanged, sort = { createdAt: -1 }) => {
  router.get(basePath, requireSportsAdmin, asyncRoute(async (req, res) => res.json(await Model.find(filter(req)).sort(sort))));
  router.post(basePath, requireSportsAdmin, asyncRoute(async (req, res) => { const data = pick(req.body || {}, fields); const item = await Model.create(data); if (onChanged) await onChanged(item, req); res.status(201).json(item); }));
  router.put(`${basePath}/:id`, requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id)) return; const item = await Model.findByIdAndUpdate(req.params.id, pick(req.body || {}, fields), { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: 'Registro no encontrado.' }); if (onChanged) await onChanged(item, req); res.json(item); }));
  router.delete(`${basePath}/:id`, requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id)) return; const item = await Model.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ message: 'Registro no encontrado.' }); if (onChanged) await onChanged(item, req); res.status(204).end(); }));
};
crud('/teams', SportsTeam, ['tournament', 'name', 'shortName', 'code', 'crest', 'city', 'coach', 'primaryColor', 'secondaryColor', 'active'], req => req.query.tournament ? { tournament: req.query.tournament } : {});
router.get('/players/by-tournament/:tournamentId', requireSportsAdmin, asyncRoute(async (req, res) => {
  if (invalidId(res, req.params.tournamentId)) return;
  const teamIds = await SportsTeam.find({ tournament: req.params.tournamentId }).distinct('_id');
  res.json(await SportsPlayer.find({ team: { $in: teamIds } }).sort({ fullName: 1 }));
}));
crud('/players', SportsPlayer, ['team', 'fullName', 'sportsName', 'number', 'position', 'photo', 'starter', 'captain', 'goalkeeper', 'active'], req => req.query.team ? { team: req.query.team } : {});
crud('/sponsors', Sponsor, ['tournament', 'name', 'headline', 'description', 'location', 'phone', 'url', 'category', 'backgroundColor', 'textColor', 'accentColor', 'durationSeconds', 'order', 'active', 'primary', 'showBug', 'logo'], req => req.query.tournament ? { tournament: req.query.tournament } : {}, async (sponsor, req) => updateOverlayState(sponsor.tournament, {}, req.sportsAdmin._id), { order: 1, createdAt: 1 });

router.get('/matches', requireSportsAdmin, asyncRoute(async (req, res) => res.json(await SportsMatch.find(req.query.tournament ? { tournament: req.query.tournament } : {}).populate('homeTeam awayTeam').sort({ scheduledAt: 1 }))));
router.post('/matches', requireSportsAdmin, asyncRoute(async (req, res) => { if (String(req.body?.homeTeam) === String(req.body?.awayTeam)) return res.status(400).json({ message: 'El equipo local y visitante deben ser diferentes.' }); const match = await SportsMatch.create(pick(req.body || {}, ['tournament', 'homeTeam', 'awayTeam', 'scheduledAt', 'stadium', 'round', 'status', 'lineups'])); res.status(201).json(match); }));
router.put('/matches/:id', requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id)) return; if (req.body?.homeTeam && String(req.body.homeTeam) === String(req.body.awayTeam)) return res.status(400).json({ message: 'El equipo local y visitante deben ser diferentes.' }); const match = await SportsMatch.findByIdAndUpdate(req.params.id, pick(req.body || {}, ['homeTeam', 'awayTeam', 'scheduledAt', 'stadium', 'round', 'status', 'lineups', 'score', 'stats', 'officials', 'broadcastTeam']), { new: true, runValidators: true }); if (!match) return res.status(404).json({ message: 'Partido no encontrado.' }); await updateOverlayState(match.tournament, {}, req.sportsAdmin._id); res.json(match); }));
router.get('/matches/:id/events', requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id)) return; res.json(await SportsEvent.find({ match: req.params.id }).sort({ createdAt: -1 }).populate('team player playerIn playerOut')); }));

router.post('/matches/:id/control', requireSportsAdmin, asyncRoute(async (req, res) => {
  if (invalidId(res, req.params.id)) return; const match = await SportsMatch.findById(req.params.id); if (!match) return res.status(404).json({ message: 'Partido no encontrado.' });
  const action = String(req.body?.action || ''); const before = match.toObject(); let graphic = null; let eventType = action; const now = new Date();
  if (action === 'goal_home' || action === 'goal_away') { const side = action.endsWith('home') ? 'home' : 'away'; match.score[side] += 1; eventType = 'gol'; graphic = { type: 'gol', data: { ...(req.body?.data || {}), side, teamName: req.body?.teamName || '' } }; }
  else if (action === 'score_manual') { match.score.home = Math.max(0, Number(req.body?.home) || 0); match.score.away = Math.max(0, Number(req.body?.away) || 0); eventType = 'correccion_marcador'; }
  else if (action === 'penalty_home' || action === 'penalty_away') { const side = action.endsWith('home') ? 'home' : 'away'; match.score[side === 'home' ? 'penaltiesHome' : 'penaltiesAway'] += 1; match.clock.period = 'Penales'; eventType = 'penal_convertido'; graphic = { type: 'penal', data: { ...(req.body?.data || {}), side, teamName: req.body?.teamName || '' } }; }
  else if (action === 'clock_start') { match.clock = startClock(match.clock, now); match.status = 'en_vivo'; }
  else if (action === 'clock_pause') { match.clock = pauseClock(match.clock, now); }
  else if (action === 'clock_reset') { match.clock = { elapsedSeconds: 0, startedAt: null, running: false, period: match.clock.period, addedTime: 0 }; }
  else if (action === 'clock_correct') { match.clock = { ...pauseClock(match.clock, now), elapsedSeconds: Math.max(0, Number(req.body?.seconds) || 0) }; eventType = 'correccion_cronometro'; }
  else if (action === 'clock_add') { match.clock = { ...pauseClock(match.clock, now), elapsedSeconds: Math.max(0, currentElapsedSeconds(match.clock, now) + (Number(req.body?.seconds) || 0)) }; }
  else if (action === 'period') { match.clock.period = String(req.body?.period || 'Primer tiempo'); match.status = req.body?.status || (match.clock.period === 'Descanso' ? 'descanso' : match.status); eventType = 'cambio_periodo'; }
  else if (action === 'added_time') { match.clock.addedTime = Math.max(0, Number(req.body?.minutes) || 0); }
  else if (action === 'stats') { const side = ['home', 'away'].includes(req.body?.side) ? req.body.side : null; const field = ['possession', 'shots', 'onTarget', 'corners', 'fouls'].includes(req.body?.field) ? req.body.field : null; if (!side || !field) return res.status(400).json({ message: 'Estadística no válida.' }); const value = Math.max(0, Number(req.body?.value) || 0); match.stats[side][field] = field === 'possession' ? Math.min(100, value) : value; if (field === 'possession') match.stats[side === 'home' ? 'away' : 'home'].possession = 100 - match.stats[side].possession; eventType = 'actualizacion_estadistica'; }
  else if (action === 'discipline') { const side = ['home', 'away'].includes(req.body?.side) ? req.body.side : null; const field = ['yellowCards', 'redCards'].includes(req.body?.field) ? req.body.field : null; if (!side || !field) return res.status(400).json({ message: 'Tarjeta no válida.' }); match.discipline[side][field] = Math.max(0, (Number(match.discipline[side][field]) || 0) + (Number(req.body?.delta) || 0)); eventType = field === 'redCards' ? 'tarjeta_roja' : 'tarjeta_amarilla'; graphic = { type: field === 'redCards' ? 'red_card' : 'yellow_card', data: req.body?.data || {} }; }
  else if (action === 'graphic') { const type = String(req.body?.type || 'aviso'); const duration = req.body?.duration === undefined ? 8000 : Math.max(0, Number(req.body.duration) || 0); graphic = { id: crypto.randomUUID(), type, data: req.body?.data || {}, activatedAt: now, expiresAt: duration ? new Date(now.getTime() + duration) : null, duration }; const mainTypes = ['presentacion', 'enfrentamiento', 'alineacion_local', 'alineacion_visitante', 'formacion_local', 'formacion_visitante', 'descanso', 'resultado_final', 'estadisticas', 'tabla_vivo', 'arbitros']; const lowerTypes = ['rotulo_jugador', 'rotulo_entrenador', 'narradores', 'comentaristas', 'rotulo', 'jugador_destacado']; if (mainTypes.includes(type)) { const isFullscreen = ['descanso', 'resultado_final', 'estadisticas', 'tabla_vivo'].includes(type); await updateOverlayState(match.tournament, { mainGraphic: graphic, ...(isFullscreen ? { scoreboardVisible: false, temporaryGraphic: null } : {}) }, req.sportsAdmin._id); await SportsEvent.create({ match: match._id, tournament: match.tournament, type: `grafico_${type}`, period: match.clock.period, actor: req.sportsAdmin._id, reversible: false }); return res.json({ match, snapshot: await getOverlaySnapshot(match.tournament) }); } if (lowerTypes.includes(type)) { await updateOverlayState(match.tournament, { lowerThird: graphic }, req.sportsAdmin._id); await SportsEvent.create({ match: match._id, tournament: match.tournament, type: `rotulo_${type}`, period: match.clock.period, actor: req.sportsAdmin._id, reversible: false }); return res.json({ match, snapshot: await getOverlaySnapshot(match.tournament) }); } }
  else if (action === 'hide_graphic') { const layer = String(req.body?.layer || 'temporary'); const changes = layer === 'main' ? { mainGraphic: null } : layer === 'lower' ? { lowerThird: null } : { temporaryGraphic: null }; await updateOverlayState(match.tournament, changes, req.sportsAdmin._id); return res.json({ match, snapshot: await getOverlaySnapshot(match.tournament) }); }
  else if (action === 'clear_graphics') { await updateOverlayState(match.tournament, { mainGraphic: null, temporaryGraphic: null, lowerThird: null }, req.sportsAdmin._id); return res.json({ match, snapshot: await getOverlaySnapshot(match.tournament) }); }
  else if (action === 'hide_all') { await updateOverlayState(match.tournament, { mainGraphic: null, temporaryGraphic: null, lowerThird: null, scoreboardVisible: false, clockVisible: false, channelBugVisible: false, sponsorBugVisible: false }, req.sportsAdmin._id); return res.json({ match, snapshot: await getOverlaySnapshot(match.tournament) }); }
  else if (action === 'scoreboard') { await updateOverlayState(match.tournament, { scoreboardVisible: Boolean(req.body?.visible) }, req.sportsAdmin._id); return res.json({ match, snapshot: await getOverlaySnapshot(match.tournament) }); }
  else if (action === 'layer') { const allowed = ['clockVisible', 'channelBugVisible', 'sponsorBugVisible']; const field = String(req.body?.field || ''); if (!allowed.includes(field)) return res.status(400).json({ message: 'Capa permanente no válida.' }); await updateOverlayState(match.tournament, { [field]: Boolean(req.body?.visible) }, req.sportsAdmin._id); return res.json({ match, snapshot: await getOverlaySnapshot(match.tournament) }); }
  else if (action === 'preset') { const preset = String(req.body?.preset || ''); const presets = { inicio: { mainGraphic: { id: crypto.randomUUID(), type: 'presentacion', activatedAt: now, data: {} }, temporaryGraphic: null, lowerThird: null, scoreboardVisible: false, clockVisible: false }, juego: { mainGraphic: null, temporaryGraphic: null, scoreboardVisible: true, clockVisible: true }, descanso: { mainGraphic: { id: crypto.randomUUID(), type: 'descanso', activatedAt: now, data: {} }, temporaryGraphic: null, lowerThird: null, scoreboardVisible: false, clockVisible: false }, segundo_tiempo: { mainGraphic: null, temporaryGraphic: null, scoreboardVisible: true, clockVisible: true }, final: { mainGraphic: { id: crypto.randomUUID(), type: 'resultado_final', activatedAt: now, data: {} }, temporaryGraphic: null, lowerThird: null, scoreboardVisible: false, clockVisible: false } }; if (!presets[preset]) return res.status(400).json({ message: 'Escena rápida no válida.' }); if (preset === 'segundo_tiempo') { match.clock.period = 'Segundo tiempo'; match.status = 'en_vivo'; } if (preset === 'final') { match.clock = pauseClock(match.clock, now); match.status = 'finalizado'; } await match.save(); const { snapshot } = await updateOverlayState(match.tournament, presets[preset], req.sportsAdmin._id); await SportsEvent.create({ match: match._id, tournament: match.tournament, type: `preset_${preset}`, period: match.clock.period, actor: req.sportsAdmin._id, reversible: false }); return res.json({ match, snapshot }); }
  else if (['yellow_card', 'red_card', 'substitution', 'var', 'injury', 'penalty_missed'].includes(action)) { graphic = { type: action, data: req.body?.data || {} }; }
  else return res.status(400).json({ message: 'Acción de control no reconocida.' });
  if (graphic && !graphic.id) {
    const duration = req.body?.duration === undefined ? 8000 : Math.max(0, Number(req.body.duration) || 0);
    graphic = { id: crypto.randomUUID(), ...graphic, activatedAt: now, expiresAt: duration ? new Date(now.getTime() + duration) : null, duration };
  }
  await match.save();
  const stateChanges = action === 'clock_start'
    ? { clockVisible: true, scoreboardVisible: true, ...(graphic ? { temporaryGraphic: graphic } : {}) }
    : graphic ? { temporaryGraphic: graphic } : {};
  const { snapshot } = await updateOverlayState(match.tournament, stateChanges, req.sportsAdmin._id);
  await SportsEvent.create({ match: match._id, tournament: match.tournament, team: req.body?.team, player: req.body?.player, playerIn: req.body?.playerIn, playerOut: req.body?.playerOut, type: eventType, minute: Math.floor(currentElapsedSeconds(match.clock) / 60), period: match.clock.period, data: req.body?.data, previousState: { match: before }, actor: req.sportsAdmin._id, reversible: action !== 'clock_start' && action !== 'clock_pause' });
  res.json({ match, snapshot });
}));
router.post('/matches/:id/undo', requireSportsAdmin, asyncRoute(async (req, res) => { if (invalidId(res, req.params.id)) return; const event = await SportsEvent.findOne({ match: req.params.id, reversible: true, undoneAt: null }).sort({ createdAt: -1 }); if (!event?.previousState?.match) return res.status(400).json({ message: 'No hay una acción reversible.' }); const prior = event.previousState.match; const match = await SportsMatch.findByIdAndUpdate(req.params.id, { score: prior.score, clock: prior.clock, status: prior.status }, { new: true }); event.undoneAt = new Date(); await event.save(); const { snapshot } = await updateOverlayState(match.tournament, { temporaryGraphic: null }, req.sportsAdmin._id); res.json({ match, snapshot, undoneEvent: event._id }); }));

router.post('/upload', requireSportsAdmin, upload.single('file'), asyncRoute(async (req, res) => { if (!req.file || !validImageTypes.has(req.file.mimetype)) return res.status(400).json({ message: 'Selecciona una imagen PNG, JPG, WebP o SVG válido de hasta 5 MB.' }); if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_SECRET) return res.status(503).json({ message: 'Cloudinary no está configurado.' }); const result = await new Promise((resolve, reject) => cloudinary.uploader.upload_stream({ folder: `imbabura-en-vivo/${slugify(req.body?.folder || 'recursos')}`, resource_type: 'image', allowed_formats: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }, (error, value) => error ? reject(error) : resolve(value)).end(req.file.buffer)); res.status(201).json({ publicId: result.public_id, secureUrl: result.secure_url, width: result.width, height: result.height, format: result.format }); }));

router.get('/remote/tournaments/:slug', asyncRoute(async (req, res) => { const tournament = await findTournamentByRemoteToken(req.params.slug, req.query.token); if (!tournament) return res.status(403).json({ message: 'El enlace de control no es válido.' }); res.json(await getOverlaySnapshot(tournament._id)); }));
router.post('/remote/tournaments/:slug/control', asyncRoute(async (req, res) => {
  const tournament = await findTournamentByRemoteToken(req.params.slug, req.query.token || req.body?.token);
  if (!tournament) return res.status(403).json({ message: 'El enlace de control no es válido.' });
  if (!tournament.activeMatch) return res.status(409).json({ message: 'No hay un partido activo para controlar.' });
  if (!remoteActions.has(String(req.body?.action || ''))) return res.status(400).json({ message: 'Esta acción no está disponible en el control remoto.' });
  res.json(await runMatchControl({ matchId: tournament.activeMatch, input: req.body || {} }));
}));

router.get('/overlay/tournaments/:slug', asyncRoute(async (req, res) => { const tournament = await findTournamentByOverlayToken(req.params.slug, req.query.token); if (!tournament) return res.status(403).json({ message: 'El enlace del overlay no es válido.' }); res.json(await getOverlaySnapshot(tournament._id)); }));
router.post('/overlay/tournaments/:slug/heartbeat', asyncRoute(async (req, res) => { const tournament = await findTournamentByOverlayToken(req.params.slug, req.query.token || req.body?.token); if (!tournament) return res.status(403).json({ message: 'El enlace del overlay no es válido.' }); await recordOverlayHeartbeat(tournament._id); res.status(204).end(); }));
router.post('/overlay/auth', asyncRoute(async (req, res) => { const slug = req.body?.slug || req.query?.slug; const token = req.body?.token || req.query?.token; const tournament = await findTournamentByOverlayToken(slug, token); const expected = tournament && overlayChannel(tournament._id); if (!tournament || req.body?.channel_name !== expected || !req.body?.socket_id) return res.status(403).json({ message: 'No autorizado.' }); res.json(authenticateOverlayChannel(req.body.socket_id, req.body.channel_name)); }));

router.use((error, req, res, next) => { if (error?.status) return res.status(error.status).json({ message: error.message }); if (error?.code === 11000) return res.status(409).json({ message: 'Ya existe un registro con ese dato.' }); if (error?.name === 'ValidationError') return res.status(400).json({ message: Object.values(error.errors)[0]?.message || 'Datos no válidos.' }); if (error?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'La imagen excede el límite de 5 MB.' }); console.error('Error en API deportiva:', error.message); return res.status(500).json({ message: error.message || 'Error interno del servidor.' }); });

export default router;
