import express from 'express';
import { requireSportsAdmin } from '../middleware/sportsAuth.js';
import Tournament from '../models/Tournament.js';
import { obsAudio } from '../services/obsAudioService.js';

const router = express.Router();
const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const invalid = message => Object.assign(new Error(message), { status: 400 });
router.use(requireSportsAdmin);
router.get('/obs/audio', route(async (req, res) => res.json(await obsAudio.status(req.query.reconnect === '1'))));
router.patch('/obs/audio', route(async (req, res) => {
  const body = req.body || {};
  for (const key of ['volumePercent', 'ambientPercent']) if (body[key] !== undefined && (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || body[key] < 0 || body[key] > 100)) throw invalid('El volumen debe estar entre 0 y 100 %.');
  for (const key of ['muted', 'duckEnabled']) if (body[key] !== undefined && typeof body[key] !== 'boolean') throw invalid('Estado de audio no válido.');
  if (body.inputName !== undefined && (typeof body.inputName !== 'string' || !body.inputName.trim() || body.inputName.length > 200)) throw invalid('Selecciona una fuente de OBS.');
  const input = Object.fromEntries(['inputName', 'muted', 'volumePercent', 'ambientPercent', 'duckEnabled'].filter(key => body[key] !== undefined).map(key => [key, body[key]]));
  if (body.tournamentId !== undefined) {
    if (!/^[a-f\d]{24}$/i.test(String(body.tournamentId)) || !await Tournament.exists({ _id: body.tournamentId })) throw invalid('Selecciona un evento válido.');
    input.tournament = body.tournamentId;
  }
  res.json(await obsAudio.update(input));
}));
export default router;
