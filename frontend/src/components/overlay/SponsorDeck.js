import React, { useEffect, useState } from 'react';
import { sponsorPlayback } from '../../utils/sponsorPlayback';
import './sponsor-deck.css';

export default function SponsorDeck({ tournament, sponsors = [], snapshot, api, onSnapshot, onConfigure, loading = false }) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  const playback = sponsorPlayback(snapshot?.sponsorDeck, now);
  const brands = sponsors.filter(s => s.active !== false && s.confirmed !== false);
  const pending = sponsors.filter(s => s.active !== false && s.confirmed === false);
  const send = async (action, sponsorId) => {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await api(`/tournaments/${tournament._id}/sponsors/control`, { method: 'POST', body: JSON.stringify({ action, sponsorId }) }); onSnapshot(result.snapshot); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section className="sponsor-deck" aria-label="Control de publicidad"><header><div><span className="eyebrow">PUBLICIDAD</span><h2>Auspiciantes del evento <span className="brand-count">{brands.length}</span></h2></div><button className="outline" onClick={onConfigure}>Editar pauta</button></header>
    {error && <p role="alert" className="brand-error">{error}</p>}
    <div className="sponsor-deck-status" role="status">{playback.active ? <><strong>{playback.mode === 'logos' ? 'LOGO EN AIRE' : playback.item.kind === 'video' ? 'ANUNCIO EN AIRE' : 'LOGO MANUAL'} · {playback.item.name}</strong><span>{playback.remaining}s · {playback.index + 1}/{playback.count} · {playback.item.kind === 'video' && !playback.item.muted ? 'Con audio' : 'Sin audio'}</span>{playback.mode === 'ads' && playback.logosRunning && <small>La rotación de logos se reanuda al terminar.</small>}</> : <span>Publicidad oculta</span>}</div>
    <fieldset disabled={busy}><div className="sponsor-deck-actions"><button aria-pressed={playback.mode === 'logos'} disabled={!brands.some(s => s.logo?.secureUrl || s.mediaLogo)} onClick={() => send('logos')}>Rotar logos · sin audio</button><button disabled={!brands.some(s => s.mediaVideo)} onClick={() => send('ads')}>Reproducir tanda publicitaria</button><button className="outline" disabled={!playback.active} onClick={() => send('stop')}>Detener / ocultar publicidad</button></div>
      <details className="sponsor-manual-controls" open><summary>Elegir una marca <span>{brands.length} disponibles</span></summary><div className="sponsor-deck-grid">{brands.map(brand => <article key={brand._id} className={playback.item?.sponsorId === brand._id ? 'sponsor-deck-brand is-on-air' : 'sponsor-deck-brand'}><div className="sponsor-deck-brand-heading">{brand.logo?.secureUrl && <img src={brand.logo.secureUrl} alt="" />}<div><h3>{brand.name}</h3><small>{brand.mediaVideo ? brand.videoMuted ? 'Video sin audio' : 'Video con audio' : 'Sin video publicitario'}</small></div></div><div><button className="outline" disabled={!brand.logo?.secureUrl && !brand.mediaLogo} onClick={() => send('manual_logo', brand._id)}>Mostrar logo</button><button disabled={!brand.mediaVideo} onClick={() => send('manual_video', brand._id)}>Reproducir anuncio</button></div></article>)}</div></details>
    </fieldset>{loading ? <p role="status">Cargando los auspiciantes asignados a este evento…</p> : !brands.length && <p>{!sponsors.length ? 'Este evento todavía no tiene auspiciantes asignados.' : pending.length ? `${pending.length} marcas ya asignadas están pendientes de confirmación. Revisa su participación en la configuración del evento.` : 'Los auspiciantes de este evento están pausados. Actívalos desde su configuración.'}</p>}
  </section>;
}
