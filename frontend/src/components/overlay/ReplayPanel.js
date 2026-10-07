import React, { useCallback, useEffect, useRef, useState } from 'react';
import './replay.css';
import ControlIcon from './ControlIcon';

export default function ReplayPanel({ tournament, api, onConfigure }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [page, setPage] = useState(0);
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
    try { const data = await api('/obs/replay/control', { method: 'POST', body: JSON.stringify({ action, tournamentId: tournament._id, ...(clipId ? { clipId } : {}), ...extra }) }); if (id === sequence.current) setStatus(data); if (action === 'save') setPage(0); return true; }
    catch (e) { if (id === sequence.current) setError(e.message); return false; }
    finally { pending.current = false; setBusy(false); }
  };
  const replay = status?.replay || {};
  const hasReplayStatus = typeof replay.bufferAvailable === 'boolean';
  const ready = Boolean(status?.connected && replay.bufferAvailable);
  const locked = busy || replay.pending || !status?.connected;
  const clips = (replay.clips || []).filter(clip => clip.tournamentId === tournament._id);
  const pageCount = Math.max(1, Math.ceil(clips.length / 6));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleClips = clips.slice(currentPage * 6, currentPage * 6 + 6);
  const clipName = (clip, index) => clip.name || (index === 0 ? 'Última jugada' : `Jugada ${clips.length - index}`);
  const commitEdit = async event => {
    event.preventDefault();
    if (await send(editing.mode, editing.id, editing.mode === 'rename' ? { name: editing.name.trim() } : {})) { setEditing(null); setMenuId(null); }
  };
  return <section className="replay-panel" aria-label="Control de repeticiones"><header><div><span className="eyebrow">REPETICIONES</span><h2>Jugada a jugada</h2></div><span className={`replay-signal ${replay.bufferActive ? 'is-active' : ''}`}>{!status?.connected ? 'Sin conexión' : !hasReplayStatus ? 'Estado no disponible' : replay.playingClipId ? 'REPETICIÓN EN AIRE' : replay.bufferActive ? 'Capturando' : 'Búfer detenido'}</span></header>
    {(error || replay.error) && <p className="brand-error" role="alert">{error || replay.error}</p>}
    {!status?.connected && <p className="replay-help">{status?.message || 'Comprobando el puente de casa…'}</p>}
    {status?.connected && !hasReplayStatus && <p className="replay-help" role="status">El servidor o el puente de casa necesita actualizarse para informar las repeticiones. Si usas localhost, reinicia el backend con la versión actual.</p>}
    {status?.connected && replay.bufferAvailable === false && <p className="replay-help">Habilita el búfer de repetición en Ajustes → Salida de OBS. La duración se configura allí; recomendamos 20 segundos.</p>}
    <div className="replay-actions" aria-label="Acciones rápidas de repetición"><button className="replay-save" disabled={locked || !ready || !replay.bufferActive || Boolean(replay.playingClipId)} onClick={() => send('save')}><ControlIcon name="save" /><span>Guardar jugada</span></button><button className="outline replay-latest" disabled={locked || !ready || !clips.length || Boolean(replay.playingClipId)} onClick={() => send('play', clips[0].id)}><ControlIcon name="replay" /><span>Reproducir última</span></button><button className="outline replay-return" disabled={locked || !replay.playingClipId} onClick={() => send('stop')}><ControlIcon name="back" /><span>Volver al directo</span></button></div>
    {!replay.bufferActive && <button className="outline replay-start" disabled={locked || !ready || Boolean(replay.playingClipId)} onClick={() => send('start')}><ControlIcon name="capture" />Iniciar captura</button>}
    {replay.pending && <p className="replay-help" role="status">Orden enviada · esperando confirmación de casa…</p>}
    <div className="replay-library-heading"><h3>Jugadas guardadas <span>{clips.length}</span></h3><small>Toca para emitir</small></div>
    <div className="replay-list">{visibleClips.map((clip, position) => { const index = currentPage * 6 + position; return <article key={clip.id} className={`${clip.id === replay.playingClipId ? 'is-on-air' : ''} ${editing?.id === clip.id || menuId === clip.id ? 'is-editing' : ''}`}>
      <div className="replay-clip-main">
        <button className="replay-clip-pad" aria-label={`${clip.id === replay.playingClipId ? 'En aire' : 'Reproducir'} ${clipName(clip, index)}`} disabled={locked || !ready || Boolean(replay.playingClipId)} onClick={() => send('play', clip.id)}><span className="replay-pad-symbol"><ControlIcon name="play" /><span>{clip.id === replay.playingClipId ? 'EN AIRE' : `CLIP ${clips.length - index}`}</span></span><strong>{clipName(clip, index)}</strong><small>{new Date(clip.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small></button>
        <button className="outline replay-more" aria-label={`Opciones de ${clipName(clip, index)}`} aria-expanded={menuId === clip.id} disabled={locked} onClick={() => { setMenuId(menuId === clip.id ? null : clip.id); setEditing(null); }}>⋯</button>
      </div>
      {menuId === clip.id && !editing && <div className="replay-clip-options"><button className="outline" disabled={locked} onClick={() => setEditing({ id: clip.id, mode: 'rename', name: clipName(clip, index) })}>Renombrar</button><button className="outline replay-delete" disabled={locked || clip.id === replay.playingClipId} onClick={() => setEditing({ id: clip.id, mode: 'delete', name: clipName(clip, index) })}>Eliminar</button></div>}
      {editing?.id === clip.id && <form className="replay-clip-edit" onSubmit={commitEdit}>
        {editing.mode === 'rename' ? <label>Nombre de la jugada<input autoFocus maxLength={80} value={editing.name} disabled={locked} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Ej. Gol de San Juan · minuto 24" /></label> : <p>¿Eliminar “{editing.name}” de las repeticiones?<small>Se quitará de la web. El archivo original se conserva en la computadora de OBS.</small></p>}
        <div className="replay-clip-options"><button className="outline" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button><button className={editing.mode === 'delete' ? 'replay-delete-confirm' : ''} disabled={locked || (editing.mode === 'rename' ? !editing.name.trim() : clip.id === replay.playingClipId)}>{editing.mode === 'rename' ? 'Guardar nombre' : 'Confirmar eliminación'}</button></div>
      </form>}
    </article>; })}</div>
    {pageCount > 1 && <nav className="replay-pages" aria-label="Páginas de jugadas"><button className="outline" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setMenuId(null); setEditing(null); }}>← Recientes</button><span>{currentPage + 1} / {pageCount}</span><button className="outline" disabled={currentPage === pageCount - 1} onClick={() => { setPage(currentPage + 1); setMenuId(null); setEditing(null); }}>Anteriores →</button></nav>}
    <details className="replay-deck-settings"><summary>Ajustes y ayuda</summary><p className="replay-help">Guarda los últimos segundos de OBS. Al terminar la jugada, vuelve al directo automáticamente.</p>{onConfigure && <button className="outline replay-configure" onClick={onConfigure}>Logo y animación</button>}{replay.bufferActive && <button className="outline" disabled={locked || !ready || Boolean(replay.playingClipId)} onClick={() => send('stop_buffer')}>Detener captura</button>}</details>
    {!clips.length && <div className="replay-empty">Todavía no hay jugadas guardadas en este evento.<span>Inicia la captura y pulsa «Guardar jugada» después de una acción.</span></div>}
  </section>;
}
