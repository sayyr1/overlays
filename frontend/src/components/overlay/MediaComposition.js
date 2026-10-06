import React, { useEffect, useRef, useState } from 'react';

export function mediaTiming(layer, now) {
  const elapsed = Math.max(0, (now - new Date(layer.activatedAt).getTime()) / 1000) || 0;
  const expired = layer.expiresAt && new Date(layer.expiresAt).getTime() <= now;
  const ended = layer.kind === 'video' && !layer.config.loop && layer.mediaDuration > 0 && elapsed >= layer.mediaDuration;
  return { elapsed, expired, ended };
}

function MediaLayer({ layer, now, preview }) {
  const ref = useRef(null);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const c = layer.config;
  const timing = mediaTiming(layer, now);
  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;
    const sync = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const elapsed = Math.max(0, (Date.now() - new Date(layer.activatedAt).getTime()) / 1000);
      const target = layer.playing === false ? 0 : c.loop ? elapsed % video.duration : Math.min(elapsed, Math.max(0, video.duration - 0.04));
      if (Math.abs(video.currentTime - target) > 0.7) video.currentTime = target;
      if (layer.playing === false || (!c.loop && elapsed >= video.duration)) video.pause();
      else video.play().catch(() => setFailed(true));
    };
    video.addEventListener('loadedmetadata', sync);
    sync();
    const timer = setInterval(sync, 2000);
    return () => { clearInterval(timer); video.removeEventListener('loadedmetadata', sync); video.pause(); };
  }, [layer.id, layer.activatedAt, layer.playing, c.loop]);
  const finished = layer.playing !== false && (ended || timing.ended);
  if (timing.expired || (finished && c.endBehavior === 'hide')) return null;
  return <div className="tv-media-layer" data-slot={layer.slot} style={{ left: c.x, top: c.y, width: c.width, height: c.height, opacity: c.opacity, zIndex: c.zIndex }}>
    {!(finished && c.endBehavior === 'text') && (layer.kind === 'video'
      ? <video ref={ref} src={layer.secureUrl} muted={preview || c.muted} playsInline loop={c.loop} preload="auto" onEnded={() => setEnded(true)} onError={() => setFailed(true)} style={{ objectFit: c.fit }} />
      : <img src={layer.secureUrl} alt="" onError={() => setFailed(true)} style={{ objectFit: c.fit }} />)}
    {timing.elapsed >= c.textDelay && (c.title || c.subtitle) && <div className="tv-media-copy" style={{ left: c.textX, top: c.textY, fontSize: c.fontSize }}><strong>{c.title}</strong><span>{c.subtitle}</span></div>}
    {failed && preview && <span className="tv-media-error">No se pudo reproducir: {layer.name}</span>}
  </div>;
}

export default function MediaComposition({ layers = {}, now, preview }) {
  return Object.values(layers).filter(layer => layer.visible && layer.config && layer.secureUrl).map(layer => <MediaLayer key={layer.id} layer={layer} now={now} preview={preview} />);
}
