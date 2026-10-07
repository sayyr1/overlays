import express from 'express';
import crypto from 'node:crypto';
import { requireSportsAdmin } from '../middleware/sportsAuth.js';
import Tournament from '../models/Tournament.js';
import ObsBridge from '../models/ObsBridge.js';
import MediaAsset from '../models/MediaAsset.js';
import { getBridge, bridgeFresh, remoteAudioView } from '../services/remoteObsAudio.js';

const router = express.Router();
router.get('/tournaments/:id/replay-branding', requireSportsAdmin, async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Evento no válido.' });
    const event = await Tournament.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ message: 'Evento no encontrado.' });
    res.json(event.replayBranding || { asset: null, placement: 'corner', showLabel: true });
  } catch (error) { next(error); }
});
router.put('/tournaments/:id/replay-branding', requireSportsAdmin, async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Evento no válido.' });
    const { assetId, placement, showLabel } = req.body || {};
    if (!['corner', 'overlay', 'intro'].includes(placement) || typeof showLabel !== 'boolean') return res.status(400).json({ message: 'Configuración de repetición no válida.' });
    let asset = null;
    if (assetId) {
      if (!/^[a-f\d]{24}$/i.test(String(assetId))) return res.status(400).json({ message: 'Archivo no válido.' });
      const media = await MediaAsset.findById(assetId).lean();
      if (!media || !['png', 'webp', 'jpg', 'jpeg', 'webm', 'mp4'].includes(media.format)) return res.status(400).json({ message: 'Selecciona un logo o una animación de la biblioteca.' });
      if (placement === 'intro' && (media.kind !== 'video' || !(media.duration > 0 && media.duration <= 10))) return res.status(400).json({ message: 'La entrada debe ser un video de hasta 10 segundos.' });
      asset = Object.fromEntries(['name', 'kind', 'publicId', 'secureUrl', 'format', 'width', 'height', 'duration', 'bytes'].map(key => [key, media[key]]));
      asset.id = String(media._id);
    }
    const event = await Tournament.findByIdAndUpdate(req.params.id, { $set: { replayBranding: { asset, placement, showLabel } } }, { new: true }).lean();
    if (!event) return res.status(404).json({ message: 'Evento no encontrado.' });
    res.json(event.replayBranding);
  } catch (error) { next(error); }
});
router.post('/obs/replay/control', requireSportsAdmin, async (req, res, next) => {
  try {
    const { action, tournamentId, clipId } = req.body || {};
    if (!['start', 'stop_buffer', 'save', 'play', 'stop'].includes(action)) return res.status(400).json({ message: 'Acción de repetición no válida.' });
    if (!/^[a-f\d]{24}$/i.test(String(tournamentId)) || !await Tournament.exists({ _id: tournamentId })) return res.status(400).json({ message: 'Evento no válido.' });
    const bridge = await getBridge();
    if (!bridgeFresh(bridge) || !bridge.status?.connected || !bridge.status.replay) return res.status(503).json({ message: 'El puente de repeticiones no está conectado. Comprueba OBS y actualiza el puente de casa.' });
    if (action === 'play' && !(bridge.status.replay.clips || []).some(clip => clip.id === clipId && clip.tournamentId === tournamentId)) return res.status(400).json({ message: 'Selecciona una jugada guardada de este evento.' });
    const command = { id: crypto.randomUUID(), kind: 'replay', action, tournamentId, ...(action === 'play' ? { clipId } : {}), expiresAt: new Date(Date.now() + 20000) };
    if (action === 'play') command.branding = (await Tournament.findById(tournamentId).lean())?.replayBranding || null;
    const updated = await ObsBridge.findOneAndUpdate({ key: 'home' }, { $push: { commands: { $each: [command], $slice: -30 } } }, { new: true }).select('+tokenHash').lean();
    res.json(remoteAudioView(updated));
  } catch (error) { next(error); }
});
export default router;
