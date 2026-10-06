import cloudinary from '../utils/cloudinary.js';
import MediaAsset from '../models/MediaAsset.js';
import { invalidMedia } from './mediaLayers.js';

export async function ensureVideoDuration(asset) {
  if (!asset || asset.kind !== 'video' || Number(asset.duration) > 0 || !asset.publicId) return asset;
  try {
    const resource = await cloudinary.api.resource(asset.publicId, { resource_type: 'video', media_metadata: true });
    const duration = Number(resource.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('El archivo no tiene una duración válida.');
    await MediaAsset.updateOne({ _id: asset._id }, { $set: { duration } });
    return { ...asset, duration };
  } catch {
    throw invalidMedia(`No se pudo recuperar la duración de ${asset.name || 'este video'}. Revisa el archivo publicitario de la marca.`);
  }
}
