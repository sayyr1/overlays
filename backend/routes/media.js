import express from 'express';
import crypto from 'crypto';
import cloudinary from '../utils/cloudinary.js';
import MediaAsset from '../models/MediaAsset.js';
import MediaPreset from '../models/MediaPreset.js';
import { tournamentSponsors } from '../services/sponsorAssignments.js';
import { builtinMedia, findMedia } from '../services/builtinMedia.js';
import Tournament from '../models/Tournament.js';
import OverlayState from '../models/OverlayState.js';
import { requireSportsAdmin } from '../middleware/sportsAuth.js';
import { updateOverlayState } from '../services/overlayStateService.js';
import { invalidMedia, mediaLayerChanges } from '../services/mediaLayers.js';
import { sponsorDeckChanges, sponsorPiece } from '../services/sponsorDeck.js';

const router = express.Router();
const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const validId = id => /^[a-f\d]{24}$/i.test(String(id || ''));
router.use(requireSportsAdmin);
router.post('/tournaments/:id/sponsors/control', route(async (req, res) => {
  if (!validId(req.params.id)) throw invalidMedia('Evento no válido.');
  if (!await Tournament.exists({ _id: req.params.id })) return res.status(404).json({ message: 'Evento no encontrado.' });
  const input = req.body || {};
  const manual = ['manual_logo', 'manual_video'].includes(input.action);
  if (manual && !validId(input.sponsorId)) throw invalidMedia('Selecciona una marca válida.');
  const sponsors = input.action === 'stop' ? [] : await tournamentSponsors(req.params.id, true);
  const chosen = manual ? sponsors.filter(s => String(s._id) === input.sponsorId) : sponsors;
  const kind = ['ads', 'manual_video'].includes(input.action) ? 'video' : 'logo';
  const items = (await Promise.all(chosen.map(s => sponsorPiece(s, kind)))).filter(Boolean);
  const previous = await OverlayState.findOne({ tournament: req.params.id }).lean();
  const changes = sponsorDeckChanges(previous?.sponsorDeck, input, items);
  res.json(await updateOverlayState(req.params.id, changes, req.sportsAdmin._id));
}));
router.get('/media', route(async (req, res) => res.json([...await MediaAsset.find().sort({ createdAt: -1 }).lean(), ...builtinMedia])));
router.get('/media-presets', route(async (req, res) => res.json(await MediaPreset.find().sort({ createdAt: -1 }).lean())));
router.post('/media-presets', route(async (req, res) => {
  const asset = await findMedia(req.body.assetId);
  const layer = mediaLayerChanges({ action: 'take', slot: '0', config: req.body.config }, asset)['mediaLayers.0'];
  res.status(201).json(await MediaPreset.create({ name: req.body.name, assetId: asset._id, config: layer.config }));
}));
router.delete('/media-presets/:id', route(async (req, res) => {
  if (!validId(req.params.id)) throw invalidMedia('Identificador no válido.');
  await MediaPreset.findByIdAndDelete(req.params.id);
  res.status(204).end();
}));
router.post('/media/sign', route(async (req, res) => {
  if (!process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) return res.status(503).json({ message: 'Cloudinary no está configurado.' });
  const kind = req.body.kind;
  if (!['image', 'video'].includes(kind)) throw invalidMedia('Tipo no válido.');
  const params = { timestamp: Math.floor(Date.now() / 1000), public_id: `imbabura-en-vivo/library/${crypto.randomUUID()}`, overwrite: false, allowed_formats: kind === 'video' ? 'mp4,webm' : 'png,jpg,jpeg,webp,svg' };
  res.json({ params, signature: cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET), apiKey: process.env.CLOUDINARY_API_KEY, cloudName: process.env.CLOUDINARY_CLOUD_NAME, kind });
}));
router.post('/media', route(async (req, res) => {
  const { publicId, kind, name, category } = req.body;
  if (!/^imbabura-en-vivo\/library\/[a-f\d-]{36}$/.test(String(publicId)) || !['image', 'video'].includes(kind)) throw invalidMedia('Archivo no válido.');
  const resource = await cloudinary.api.resource(publicId, { resource_type: kind, ...(kind === 'video' ? { media_metadata: true } : {}) });
  const formats = kind === 'video' ? ['mp4', 'webm'] : ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  if (!formats.includes(resource.format) || resource.bytes > (kind === 'video' ? 100 : 10) * 1024 * 1024) throw invalidMedia('Formato o tamaño no permitido (imagen 10 MB; video 100 MB).');
  if (category === 'motion' && resource.format !== 'webm') throw invalidMedia('Motion graphics requiere WebM.');
  const existing = await MediaAsset.findOne({ publicId });
  if (existing) {
    if (kind === 'video' && !(Number(existing.duration) > 0) && Number(resource.duration) > 0) return res.json(await MediaAsset.findByIdAndUpdate(existing._id, { $set: { duration: Number(resource.duration) } }, { new: true }));
    return res.json(existing);
  }
  res.status(201).json(await MediaAsset.create({ name, category, kind, publicId, secureUrl: resource.secure_url, format: resource.format, width: resource.width, height: resource.height, duration: resource.duration, bytes: resource.bytes }));
}));
router.delete('/media/:id', route(async (req, res) => {
  if (!validId(req.params.id)) throw invalidMedia('Identificador no válido.');
  // Removing the library entry must not break an on-air snapshot or another production.
  await MediaAsset.findByIdAndDelete(req.params.id);
  res.status(204).end();
}));
router.post('/tournaments/:id/media/control', route(async (req, res) => {
  if (!validId(req.params.id)) throw invalidMedia('Identificador no válido.');
  if (!await Tournament.exists({ _id: req.params.id })) return res.status(404).json({ message: 'Transmisión no encontrada.' });
  const input = { ...req.body };
  let asset;
  if (['play', 'restart'].includes(input.action)) {
    const state = await OverlayState.findOne({ tournament: req.params.id }).lean();
    const layer = state?.mediaLayers?.[String(input.slot)];
    if (!layer?.assetId) throw invalidMedia('Primero carga un recurso en esta capa.');
    // Retained snapshot remains playable after removing its library entry.
    asset = { _id: layer.assetId, name: layer.name, kind: layer.kind, secureUrl: layer.secureUrl, duration: layer.mediaDuration };
    input.config = layer.config;
  } else if (input.action === 'take') {
    if (input.sponsorId) {
      if (!validId(input.sponsorId) || !['mediaLogo', 'mediaMotion', 'mediaVideo'].includes(input.variant)) throw invalidMedia('Auspiciante o formato no válido.');
      const sponsor = (await tournamentSponsors(req.params.id, true)).find(s => String(s._id) === input.sponsorId);
      if (!sponsor) throw invalidMedia('Auspiciante no disponible.');
      if (sponsor[input.variant]) asset = await findMedia(sponsor[input.variant]);
      else if (input.variant === 'mediaLogo' && sponsor.logo?.secureUrl) asset = { _id: sponsor._id, name: sponsor.name, kind: 'image', secureUrl: sponsor.logo.secureUrl };
    } else {
      asset = await findMedia(input.assetId);
    }
  }
  const changes = mediaLayerChanges(input, asset);
  res.json(await updateOverlayState(req.params.id, changes, req.sportsAdmin._id));
}));
export default router;
