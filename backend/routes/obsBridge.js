import express from 'express';
import ObsBridge from '../models/ObsBridge.js';
import { requireSportsAdmin } from '../middleware/sportsAuth.js';
import { bridgePoll, bridgeTokenHash, remoteObsAudio } from '../services/remoteObsAudio.js';

const router = express.Router();
const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.post('/obs/bridge/pair', requireSportsAdmin, route(async (req, res) => res.json(await remoteObsAudio.pair())));
router.post('/obs/bridge/poll', route(async (req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!/^[\w-]{43}$/.test(token)) return res.status(401).json({ message: 'Vinculación no válida.' });
  const bridge = await ObsBridge.findOne({ key: 'home', tokenHash: bridgeTokenHash(token) }).select('+tokenHash').lean();
  if (!bridge) return res.status(401).json({ message: 'La vinculación expiró. Genera un archivo nuevo desde la app.' });
  const body = req.body || {};
  if (!/^[a-f\d-]{36}$/i.test(String(body.agentId)) || !Array.isArray(body.acknowledged) || body.acknowledged.length > 50 || body.acknowledged.some(id => !/^[a-f\d-]{36}$/i.test(String(id)))) return res.status(400).json({ message: 'Informe del puente no válido.' });
  const input = body.status || {};
  const status = {};
  for (const key of ['connected', 'sourceAvailable', 'muted', 'ducking']) if (typeof input[key] === 'boolean') status[key] = input[key];
  for (const key of ['volumePercent', 'outputPercent']) if (typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0 && input[key] <= 2000) status[key] = input[key];
  status.inputName = String(input.inputName || '').slice(0, 200);
  status.message = String(input.message || '').slice(0, 400);
  status.inputs = Array.isArray(input.inputs) ? input.inputs.filter(name => typeof name === 'string' && name.length <= 200).slice(0, 200) : [];
  if (input.replay && typeof input.replay === 'object') {
    const replay = input.replay;
    status.replay = { bufferAvailable: replay.bufferAvailable === true, bufferActive: replay.bufferActive === true, playingClipId: /^[a-f\d-]{36}$/i.test(String(replay.playingClipId)) ? replay.playingClipId : null, error: String(replay.error || '').slice(0, 400), clips: Array.isArray(replay.clips) ? replay.clips.filter(c => /^[a-f\d-]{36}$/i.test(String(c.id)) && /^[a-f\d]{24}$/i.test(String(c.tournamentId)) && Number.isFinite(new Date(c.savedAt).getTime())).slice(0, 50).map(c => ({ id: c.id, tournamentId: c.tournamentId, savedAt: new Date(c.savedAt).toISOString(), ...(typeof c.name === 'string' ? { name: c.name.trim().slice(0, 80) } : {}) })) : [] };
  }
  res.json(await bridgePoll(bridge, body.agentId, status, body.acknowledged));
}));
export default router;
