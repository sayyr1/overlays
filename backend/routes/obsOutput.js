import express from 'express';
import crypto from 'node:crypto';
import { requireSportsAdmin } from '../middleware/sportsAuth.js';
import ObsOutput from '../models/ObsOutput.js';
import ObsBridge from '../models/ObsBridge.js';
import Tournament from '../models/Tournament.js';
import { getOutput, outputView, findOutput, outputTokenHash } from '../services/obsOutput.js';
import { getOverlaySnapshot, recordOverlayHeartbeat } from '../services/overlayStateService.js';
import { overlayChannel, authenticateOverlayChannel } from '../services/sportsRealtime.js';

const router = express.Router();
const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.get('/obs/output', requireSportsAdmin, route(async (req, res) => {
  res.set('Cache-Control', 'no-store'); res.json(await outputView(await getOutput()));
}));
router.put('/obs/output/event', requireSportsAdmin, route(async (req, res) => {
  const id = req.body?.tournamentId;
  if (!/^[a-f\d]{24}$/i.test(String(id))) return res.status(400).json({ message: 'Selecciona un evento válido.' });
  const event = await Tournament.findById(id).lean();
  if (!event || event.active === false) return res.status(400).json({ message: 'El evento no está disponible para emitir.' });
  const output = await getOutput();
  if (String(output.tournament) === id) return res.json(await outputView(output));
  if (req.body?.expectedRevision !== undefined && req.body.expectedRevision !== output.revision) return res.status(409).json({ message: 'La salida cambió desde otro dispositivo. Revisa el evento en aire antes de confirmar.' });
  const next = await ObsOutput.findOneAndUpdate({ _id: output._id, revision: output.revision }, { $set: { tournament: id, seenRevision: -1, seenStateRevision: -1 }, $inc: { revision: 1 } }, { new: true }).select('+token').lean();
  if (!next) return res.status(409).json({ message: 'La salida cambió desde otro dispositivo. Revisa el evento en aire antes de confirmar.' });
  // The explicit on-air selection also moves ambient control to that event.
  await ObsBridge.updateOne({ key: 'home' }, { $set: { tournament: id }, $inc: { revision: 1 } });
  res.json(await outputView(next));
}));
router.post('/obs/output/rotate', requireSportsAdmin, route(async (req, res) => {
  if (req.body?.confirmation !== 'REEMPLAZAR ENLACE OBS') return res.status(400).json({ message: 'Confirma el reemplazo del enlace.' });
  await getOutput();
  const token = crypto.randomBytes(32).toString('base64url');
  const next = await ObsOutput.findOneAndUpdate({ key: 'program' }, { $set: { token, tokenHash: outputTokenHash(token), lastSeenAt: null, seenRevision: -1, seenStateRevision: -1 }, $inc: { revision: 1 } }, { new: true }).select('+token').lean();
  res.json(await outputView(next));
}));
router.get('/overlay/output', route(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const output = await findOutput(req.query.token);
  if (!output) return res.status(403).json({ message: 'El enlace de OBS no es válido.' });
  const event = output.tournament && await Tournament.findById(output.tournament).select('active').lean();
  const snapshot = event && event.active !== false ? await getOverlaySnapshot(output.tournament) : null;
  res.json({ snapshot, outputRevision: output.revision });
}));
router.post('/overlay/output/heartbeat', route(async (req, res) => {
  const output = await findOutput(req.query.token || req.body?.token);
  if (!output) return res.status(403).json({ message: 'El enlace de OBS no es válido.' });
  const revision = req.body?.outputRevision;
  const stateRevision = req.body?.stateRevision;
  const eventId = req.body?.tournamentId;
  const acknowledged = revision === output.revision && String(eventId) === String(output.tournament) && Number.isSafeInteger(stateRevision) && stateRevision >= 0;
  // An old event's delayed heartbeat cannot confirm a newly selected event.
  await ObsOutput.updateOne({ _id: output._id, revision: output.revision }, { $set: { lastSeenAt: new Date(), ...(acknowledged ? { seenRevision: revision } : {}) }, ...(acknowledged ? { $max: { seenStateRevision: stateRevision } } : {}) });
  if (acknowledged) await recordOverlayHeartbeat(output.tournament);
  res.status(204).end();
}));
router.post('/overlay/output/auth', route(async (req, res) => {
  const output = await findOutput(req.query.token || req.body?.token);
  if (!output?.tournament || req.body?.channel_name !== overlayChannel(output.tournament) || !req.body?.socket_id) return res.status(403).json({ message: 'No autorizado.' });
  if (!await Tournament.exists({ _id: output.tournament, active: true })) return res.status(403).json({ message: 'Evento no disponible.' });
  res.json(authenticateOverlayChannel(req.body.socket_id, req.body.channel_name));
}));
export default router;
