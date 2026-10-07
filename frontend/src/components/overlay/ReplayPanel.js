import React, { useCallback, useEffect, useRef, useState } from 'react';
import './replay.css';

export default function ReplayPanel({ tournament, api, onConfigure }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const sequence = useRef(0);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    const id = ++sequence.current;
    try { const data = await api('/obs/audio'); if (id === sequence.current) { setStatus(data); setError(''); } }
    catch (e) { if (id === sequence.current) setError(e.message); }
  }, [api]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 2000); return () => { clearInterval(timer); sequence.current += 1; }; }, [refresh]);
  const send = async (action, clipId, extra = {}) => {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError(''); const id = ++sequence.current;
    try { const data = await api('/obs/replay/control', { method: 'POST', body: JSON.stringify({ action, tournamentId: tournament._id, ...(clipId ? { clipId } : {}), ...extra }) }); if (id === sequence.current) setStatus(data); return true; }
    catch (e) { if (id === sequence.current) setError(e.message); return false; }
    finally { pending.current = false; setBusy(false); }
  };
  const replay = status?.replay || {};
  const hasReplayStatus = typeof replay.bufferAvailable === 'boolean';
  const ready = Boolean(status?.connected && replay.bufferAvailable);
  const locked = busy || replay.pending || !status?.connected;
  const clips = (replay.clips || []).filter(clip => clip.tournamentId === tournament._id);
  const clipName = (clip, index) => clip.name || (index === 0 ? 'Última jugada' : `Jugada ${clips.length - index}`);
  const commitEdit = async event => {
    event.preventDefault();
    if (await send(editing.mode, editing.id, editing.mode === 'rename' ? { name: editing.name.trim() } : {})) { setEditing(null); setMenuId(null); }
  };
  return <section className="replay-panel" aria-label="Control de repeticiones"><header><div><span className="eyebrow">REPETICIONES</span><h2>Jugada a jugada</h2></div><span className={`replay-signal ${replay.bufferActive ? 'is-active' : ''}`}>{!status?.connected ? 'Sin conexión' : !hasReplayStatus ? 'Estado no disponible' : replay.playingClipId ? 'REPETICIÓN EN AIRE' : replay.bufferActive ? 'Capturando' : 'Búfer detenido'}</span></header>
    {(error || replay.error) && <p className="brand-error" role="alert">{error || replay.error}</p>}
    {onConfigure && <button className="outline replay-configure" onClick={onConfigure}>Logo y animación</button>}
    {!status?.connected && <p className="replay-help">{status?.message || 'Comprobando el puente de casa…'}</p>}
    {status?.connected && !hasReplayStatus && <p className="replay-help" role="status">El servidor o el puente de casa necesita actualizarse para informar las repeticiones. Si usas localhost, reinicia el backend con la versión actual.</p>}
    {status?.connected && replay.bufferAvailable === false && <p className="replay-help">Habilita el búfer de repetición en Ajustes → Salida de OBS. La duración se configura allí; recomendamos 20 segundos.</p>}
    <div className="replay-actions"><button disabled={locked || !ready || !replay.bufferActive || Boolean(replay.playingClipId)} onClick={() => send('save')}>Guardar jugada</button><button className="outline" disabled={locked || !ready || Boolean(replay.playingClipId)} onClick={() => send(replay.bufferActive ? 'stop_buffer' : 'start')}>{replay.bufferActive ? 'Detener captura' : 'Iniciar captura'}</button><button className="outline replay-return" disabled={locked || !replay.playingClipId} onClick={() => send('stop')}>Volver al directo</button></div>
    {replay.pending && <p className="replay-help" role="status">Orden enviada · esperando confirmación de casa…</p>}
    <p className="replay-help">Guarda los últimos segundos de la salida de OBS. Reproduce una jugada cuando quieras; vuelve al directo automáticamente al terminar.</p>
    <div className="replay-list">{clips.map((clip, index) => <article key={clip.id} className={clip.id === replay.playingClipId ? 'is-on-air' : ''}>
      <div className="replay-clip-main"><div className="replay-clip-title"><strong>{clipName(clip, index)}</strong><small>{new Date(clip.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small></div>
        <button disabled={locked || !ready || Boolean(replay.playingClipId)} onClick={() => send('play', clip.id)}>{clip.id === replay.playingClipId ? 'En aire' : 'Reproducir'}</button>
        <button className="outline replay-more" aria-label={`Opciones de ${clipName(clip, index)}`} aria-expanded={menuId === clip.id} disabled={locked} onClick={() => { setMenuId(menuId === clip.id ? null : clip.id); setEditing(null); }}>⋯</button>
      </div>
      {menuId === clip.id && !editing && <div className="replay-clip-options"><button className="outline" disabled={locked} onClick={() => setEditing({ id: clip.id, mode: 'rename', name: clipName(clip, index) })}>Renombrar</button><button className="outline replay-delete" disabled={locked || clip.id === replay.playingClipId} onClick={() => setEditing({ id: clip.id, mode: 'delete', name: clipName(clip, index) })}>Eliminar</button></div>}
      {editing?.id === clip.id && <form className="replay-clip-edit" onSubmit={commitEdit}>
        {editing.mode === 'rename' ? <label>Nombre de la jugada<input autoFocus maxLength={80} value={editing.name} disabled={locked} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Ej. Gol de San Juan · minuto 24" /></label> : <p>¿Eliminar “{editing.name}” de las repeticiones?<small>Se quitará de la web. El archivo original se conserva en la computadora de OBS.</small></p>}
        <div className="replay-clip-options"><button className="outline" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button><button className={editing.mode === 'delete' ? 'replay-delete-confirm' : ''} disabled={locked || (editing.mode === 'rename' ? !editing.name.trim() : clip.id === replay.playingClipId)}>{editing.mode === 'rename' ? 'Guardar nombre' : 'Confirmar eliminación'}</button></div>
      </form>}
    </article>)}</div>
    {!clips.length && <div className="replay-empty">Todavía no hay jugadas guardadas en este evento.<span>Inicia la captura y pulsa «Guardar jugada» después de una acción.</span></div>}
  </section>;
}
