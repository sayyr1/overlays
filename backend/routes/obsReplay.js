import express from 'express';
import crypto from 'node:crypto';
import { requireSportsAdmin } from '../middleware/sportsAuth.js';
import Tournament from '../models/Tournament.js';
import ObsBridge from '../models/ObsBridge.js';
import { getBridge, bridgeFresh, remoteAudioView } from '../services/remoteObsAudio.js';

const router = express.Router();
router.post('/obs/replay/control', requireSportsAdmin, async (req, res, next) => {
  try {
    const { action, tournamentId, clipId } = req.body || {};
    if (!['start', 'stop_buffer', 'save', 'play', 'stop'].includes(action)) return res.status(400).json({ message: 'Acción de repetición no válida.' });
    if (!/^[a-f\d]{24}$/i.test(String(tournamentId)) || !await Tournament.exists({ _id: tournamentId })) return res.status(400).json({ message: 'Evento no válido.' });
    const bridge = await getBridge();
    if (!bridgeFresh(bridge) || !bridge.status?.connected || !bridge.status.replay) return res.status(503).json({ message: 'El puente de repeticiones no está conectado. Comprueba OBS y actualiza el puente de casa.' });
    if (action === 'play' && !(bridge.status.replay.clips || []).some(clip => clip.id === clipId && clip.tournamentId === tournamentId)) return res.status(400).json({ message: 'Selecciona una jugada guardada de este evento.' });
    const command = { id: crypto.randomUUID(), kind: 'replay', action, tournamentId, ...(action === 'play' ? { clipId } : {}), expiresAt: new Date(Date.now() + 20000) };
    const updated = await ObsBridge.findOneAndUpdate({ key: 'home' }, { $push: { commands: { $each: [command], $slice: -30 } } }, { new: true }).select('+tokenHash').lean();
    res.json(remoteAudioView(updated));
  } catch (error) { next(error); }
});
export default router;
