import React, { useCallback, useEffect, useRef, useState } from 'react';
import './replay.css';

export default function ReplayPanel({ tournament, api }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    const id = ++sequence.current;
    try { const data = await api('/obs/audio'); if (id === sequence.current) { setStatus(data); setError(''); } }
    catch (e) { if (id === sequence.current) setError(e.message); }
  }, [api]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 2000); return () => { clearInterval(timer); sequence.current += 1; }; }, [refresh]);
  const send = async (action, clipId) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); const id = ++sequence.current;
    try { const data = await api('/obs/replay/control', { method: 'POST', body: JSON.stringify({ action, tournamentId: tournament._id, ...(clipId ? { clipId } : {}) }) }); if (id === sequence.current) setStatus(data); }
    catch (e) { if (id === sequence.current) setError(e.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const replay = status?.replay || {};
  const ready = Boolean(status?.connected && replay.bufferAvailable);
  const locked = busy || replay.pending || !status?.connected;
  const clips = (replay.clips || []).filter(clip => clip.tournamentId === tournament._id);
  return <section className="replay-panel" aria-label="Control de repeticiones"><header><div><span className="eyebrow">REPETICIONES</span><h2>Jugada a jugada</h2></div><span className={`replay-signal ${replay.bufferActive ? 'is-active' : ''}`}>{replay.playingClipId ? 'REPETICIÓN EN AIRE' : replay.bufferActive ? 'Capturando' : 'Búfer detenido'}</span></header>
    {(error || replay.error) && <p className="brand-error" role="alert">{error || replay.error}</p>}
    {!status?.connected && <p className="replay-help">{status?.message || 'Comprobando el puente de casa…'}</p>}
    {status?.connected && !replay.bufferAvailable && <p className="replay-help">Habilita el búfer de repetición en Ajustes → Salida de OBS. La duración se configura allí; recomendamos 20 segundos.</p>}
    <div className="replay-actions"><button disabled={locked || !ready || !replay.bufferActive || Boolean(replay.playingClipId)} onClick={() => send('save')}>Guardar jugada</button><button className="outline" disabled={locked || !ready || Boolean(replay.playingClipId)} onClick={() => send(replay.bufferActive ? 'stop_buffer' : 'start')}>{replay.bufferActive ? 'Detener captura' : 'Iniciar captura'}</button><button className="outline replay-return" disabled={locked || !replay.playingClipId} onClick={() => send('stop')}>Volver al directo</button></div>
    {replay.pending && <p className="replay-help" role="status">Orden enviada · esperando confirmación de casa…</p>}
    <p className="replay-help">Guarda los últimos segundos de la salida de OBS. Reproduce una jugada cuando quieras; vuelve al directo automáticamente al terminar.</p>
    <div className="replay-list">{clips.map((clip, index) => <article key={clip.id} className={clip.id === replay.playingClipId ? 'is-on-air' : ''}><div><strong>{index === 0 ? 'Última jugada' : `Jugada ${clips.length - index}`}</strong><small>{new Date(clip.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small></div><button disabled={locked || !ready || Boolean(replay.playingClipId)} onClick={() => send('play', clip.id)}>{clip.id === replay.playingClipId ? 'En aire' : 'Reproducir'}</button></article>)}</div>
    {!clips.length && <div className="replay-empty">Todavía no hay jugadas guardadas en este evento.<span>Inicia la captura y pulsa «Guardar jugada» después de una acción.</span></div>}
  </section>;
}
