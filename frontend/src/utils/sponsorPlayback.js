export function sponsorPlayback(deck = {}, now = Date.now()) {
  const ads = deck?.ads;
  const logos = deck?.logos;
  const elapsed = sequence => Math.max(0, (now - new Date(sequence.startedAt).getTime()) / 1000);
  const adsElapsed = ads ? elapsed(ads) : 0;
  const adsActive = Boolean(ads?.items?.length && adsElapsed < ads.duration);
  const sequence = adsActive ? ads : logos;
  if (!sequence?.items?.length || !(sequence.duration > 0)) return { active: false, logosRunning: false };
  const time = adsActive ? adsElapsed : Math.max(0, elapsed(logos) - (ads ? Math.min(adsElapsed, ads.duration) : 0)) % logos.duration;
  let offset = 0;
  for (let i = 0; i < sequence.items.length; i++) {
    const item = sequence.items[i];
    if (time < offset + item.duration) return { active: true, item, index: i, count: sequence.items.length, remaining: Math.ceil(offset + item.duration - time), mode: adsActive ? 'ads' : 'logos', logosRunning: Boolean(logos), layer: { id: `${sequence.id}-${i}-${adsActive ? 0 : Math.floor((elapsed(logos) - (ads ? Math.min(adsElapsed, ads.duration) : 0)) / logos.duration)}`, slot: 'sponsor-deck', kind: item.kind === 'video' ? 'video' : 'image', name: item.name, secureUrl: item.secureUrl, visible: true, playing: true, mediaDuration: item.duration, activatedAt: new Date(now - (time - offset) * 1000).toISOString(), expiresAt: null, config: { x: 96, y: 864, width: 1728, height: 152, opacity: 1, zIndex: 60, duration: item.duration, fit: 'contain', loop: false, muted: item.kind !== 'video' || item.muted, endBehavior: 'hide', textDelay: 0, textX: 40, textY: 40, fontSize: 44 } } };
    offset += item.duration;
  }
  return { active: false, logosRunning: Boolean(logos) };
}
