import crypto from 'crypto';
import { invalidMedia } from './mediaLayers.js';
import { findMedia } from './builtinMedia.js';
import { ensureVideoDuration } from './mediaMetadata.js';

export async function sponsorPiece(sponsor, kind) {
  const logoAsset = sponsor.mediaLogo ? await findMedia(sponsor.mediaLogo) : null;
  let asset = kind === 'video' ? await findMedia(sponsor.mediaVideo) : logoAsset || (sponsor.logo?.secureUrl ? { kind: 'image', secureUrl: sponsor.logo.secureUrl } : null);
  if (!asset || asset.kind !== (kind === 'video' ? 'video' : 'image')) return null;
  if (kind === 'video') asset = await ensureVideoDuration(asset);
  if (kind === 'video' && !(Number(asset.duration) > 0)) return null;
  return { id: crypto.randomUUID(), sponsorId: String(sponsor._id), name: sponsor.name, kind, secureUrl: asset.secureUrl, duration: kind === 'video' ? Number(asset.duration) : Math.max(3, Number(sponsor.durationSeconds) || 10), muted: kind === 'logo' || sponsor.videoMuted === true, backgroundColor: sponsor.backgroundColor, textColor: sponsor.textColor, headline: sponsor.headline };
}

export function sponsorDeckChanges(previous = {}, input, items, now = new Date()) {
  if (!['logos', 'ads', 'manual_logo', 'manual_video', 'stop'].includes(input.action)) throw invalidMedia('Acción de publicidad no válida.');
  if (input.action === 'stop') return { sponsorDeck: {}, sponsorBugVisible: false, 'mediaLayers.15.visible': false };
  if (!items.length) throw invalidMedia('No hay piezas disponibles de auspiciantes confirmados y activos. Los videos necesitan una duración válida.');
  const stamp = now.getTime();
  const oldAds = previous.ads;
  const paused = oldAds ? Math.min(oldAds.duration, Math.max(0, (stamp - new Date(oldAds.startedAt).getTime()) / 1000)) : 0;
  const logos = previous.logos ? { ...previous.logos, startedAt: new Date(new Date(previous.logos.startedAt).getTime() + paused * 1000).toISOString() } : null;
  const sequence = { id: crypto.randomUUID(), startedAt: now.toISOString(), items, duration: items.reduce((sum, item) => sum + item.duration, 0) };
  const deck = input.action === 'logos' ? { logos: sequence, ads: null } : { logos, ads: sequence };
  return { sponsorDeck: deck, sponsorBugVisible: false, 'mediaLayers.15.visible': false };
}
