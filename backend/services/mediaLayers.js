import crypto from 'crypto';

export const invalidMedia = message => Object.assign(new Error(message), { status: 400 });
const number = (value, fallback, min, max) => {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw invalidMedia(`Valor fuera de rango (${min}–${max}).`);
  return n;
};
export function mediaLayerChanges(input, asset, now = new Date()) {
  const slot = String(input.slot || '');
  if (!/^(?:[0-9]|1[0-5])$/.test(slot)) throw invalidMedia('Capa no válida.');
  const path = `mediaLayers.${slot}`;
  if (input.action === 'hide') return { [`${path}.visible`]: false };
  if (input.action === 'stop') return { [`${path}.playing`]: false };
  if (!['take', 'play', 'restart'].includes(input.action) || !asset) throw invalidMedia('Recurso o acción no válido.');
  const c = input.config || {};
  const duration = number(c.duration, 0, 0, 3600);
  if (c.fit !== undefined && !['contain', 'cover', 'fill'].includes(c.fit)) throw invalidMedia('Ajuste no válido.');
  if (c.endBehavior !== undefined && !['hide', 'hold', 'text'].includes(c.endBehavior)) throw invalidMedia('Final no válido.');
  const text = (value, max) => String(value || '').slice(0, max);
  return { [path]: {
    slot, id: crypto.randomUUID(), assetId: String(asset._id), name: asset.name,
    kind: asset.kind, secureUrl: asset.secureUrl, mediaDuration: asset.duration || 0,
    visible: true, playing: true, activatedAt: now,
    expiresAt: duration ? new Date(now.getTime() + duration * 1000) : null,
    config: {
      x: number(c.x, 0, -1920, 1920), y: number(c.y, 0, -1080, 1080),
      width: number(c.width, 1920, 1, 3840), height: number(c.height, 1080, 1, 2160),
      opacity: number(c.opacity, 1, 0, 1), zIndex: number(c.zIndex, 20, 0, 100), duration,
      fit: c.fit || 'contain', loop: c.loop === true, muted: c.muted !== false,
      endBehavior: c.endBehavior || 'hide', title: text(c.title, 100), subtitle: text(c.subtitle, 180),
      textDelay: number(c.textDelay, 0, 0, 60), textX: number(c.textX, 40, 0, 3840),
      textY: number(c.textY, 40, 0, 2160), fontSize: number(c.fontSize, 44, 12, 160),
    },
  } };
}
