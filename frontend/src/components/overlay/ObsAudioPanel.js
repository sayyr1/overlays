import React, { useCallback, useEffect, useRef, useState } from 'react';
import './obs-audio.css';

export default function ObsAudioPanel({ tournament, api }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [volume, setVolume] = useState(100);
  const [ambient, setAmbient] = useState(15);
  const [pairingNote, setPairingNote] = useState('');
  const editing = useRef(false);
  const operation = useRef(0);
  const busyRef = useRef(false);
  const apply = useCallback(data => {
    setStatus(data);
    if (!editing.current && !data.pending) { setVolume(Math.min(100, data.volumePercent ?? 100)); setAmbient(data.ambientPercent ?? 15); }
  }, []);
  const refresh = useCallback(async (reconnect = false) => {
    if (busyRef.current) return;
    const id = ++operation.current;
    try { const data = await api(`/obs/audio${reconnect ? '?reconnect=1' : ''}`); if (id === operation.current) { apply(data); setError(''); } }
    catch (e) { if (id === operation.current) setError(e.message); }
  }, [api, apply]);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(), 3000);
    return () => { clearInterval(timer); operation.current += 1; };
  }, [refresh]);
  const send = async changes => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const id = ++operation.current;
    try {
      const data = await api('/obs/audio', { method: 'PATCH', body: JSON.stringify(changes) });
      if (id === operation.current) { editing.current = false; apply(data); }
    } catch (e) { if (id === operation.current) { editing.current = false; setError(e.message); } }
    finally { busyRef.current = false; setBusy(false); }
  };
  const ready = Boolean(status?.connected && status.sourceAvailable !== false);
  const locked = busy || Boolean(status?.pending);
  const enabledHere = Boolean(status?.duckEnabled && status.tournamentId === tournament._id);
  const downloadPairing = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const id = ++operation.current;
    try {
      const result = await api('/obs/bridge/pair', { method: 'POST' });
      const serverUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');
      const file = new Blob([JSON.stringify({ serverUrl, token: result.token }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a'); link.href = url; link.download = 'obs-bridge.json';
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (id === operation.current) { setPairingNote('Archivo descargado. Úsalo para iniciar el puente en la computadora de casa.'); apply(await api('/obs/audio')); }
    } catch (e) { if (id === operation.current) setError(e.message); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <section className="obs-audio-panel" aria-label="Audio del campo">
    <header><div><span className="eyebrow">AUDIO DEL CAMPO</span><h2>BELABOX · SRT</h2></div><span className={`obs-audio-signal ${ready ? 'is-connected' : ''}`} role="status">{status ? ready ? 'OBS conectado' : 'Sin conexión' : 'Conectando…'}</span></header>
    {error && <p className="brand-error" role="alert">{error}</p>}
    {!ready && <div className="obs-audio-help"><p>{status?.message || 'Comprobando la conexión con OBS…'}</p><button className="outline" onClick={() => refresh(true)} disabled={busy}>{status?.mode === 'bridge' ? 'Comprobar conexión' : 'Reconectar OBS'}</button></div>}
    <div className="obs-audio-main"><button className={`obs-audio-mute ${status?.muted ? 'is-muted' : 'outline'}`} disabled={!ready || locked} aria-pressed={Boolean(status?.muted)} onClick={() => send({ muted: !status?.muted })}>{status?.muted ? 'Activar audio del campo' : 'Silenciar campo'}</button>
      <div className="obs-audio-volume"><label htmlFor="field-volume">Volumen habitual <strong>{volume} %</strong></label><input id="field-volume" type="range" min="0" max="100" value={volume} disabled={!ready || locked} onChange={e => { editing.current = true; setVolume(Number(e.target.value)); }} onPointerUp={e => send({ volumePercent: Number(e.target.value) })} onKeyUp={e => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) send({ volumePercent: Number(e.target.value) }); }} onBlur={e => { if (editing.current) send({ volumePercent: Number(e.target.value) }); }} /></div>
    </div>
    <label className="obs-audio-auto"><input type="checkbox" checked={enabledHere} disabled={!ready || locked} onChange={e => send({ duckEnabled: e.target.checked, tournamentId: tournament._id })} /><span>Bajar ambiente durante anuncios<small>Restaura el volumen al terminar o detener. Los logos conservan el ambiente.</small></span></label>
    {status?.duckEnabled && !enabledHere && <p className="obs-audio-note">La reducción automática está asignada a otro evento. Actívala aquí para usarla en este.</p>}
    {ready && <p className={`obs-audio-state ${status.ducking ? 'is-ducking' : ''}`} role="status">{status.muted ? 'Campo silenciado manualmente' : status.ducking ? `Anuncio con audio · ambiente al ${status.outputPercent} %` : `Ambiente al ${status.outputPercent} %`}</p>}
    {status?.pending && <p className="obs-audio-note" role="status">Orden enviada · esperando confirmación de casa…</p>}
    {status?.mode === 'bridge' && <details className="obs-audio-settings" open={!status.paired}><summary>Conectar computadora de casa</summary><p>Descarga la vinculación e inicia el puente en la computadora donde está OBS. El puente debe permanecer funcionando mientras operas desde fuera.</p><button className="outline" disabled={busy} onClick={downloadPairing}>{status.paired ? 'Reemplazar vinculación' : 'Descargar vinculación'}</button>{status.paired && <p>Un archivo nuevo reemplaza la vinculación anterior.</p>}{pairingNote && <p role="status">{pairingNote}</p>}</details>}
    <details className="obs-audio-settings"><summary>Ajustes de audio</summary>
      <label htmlFor="ambient-volume">Ambiente durante anuncios <strong>{ambient} %</strong></label><input id="ambient-volume" type="range" min="0" max="100" value={ambient} disabled={!ready || busy} onChange={e => { editing.current = true; setAmbient(Number(e.target.value)); }} onPointerUp={e => send({ ambientPercent: Number(e.target.value) })} onKeyUp={e => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) send({ ambientPercent: Number(e.target.value) }); }} onBlur={e => { if (editing.current) send({ ambientPercent: Number(e.target.value) }); }} />
      <label>Fuente en OBS<select value={status?.inputName || 'BELABOX_SRT'} disabled={!status?.connected || busy} onChange={e => send({ inputName: e.target.value })}>{!status?.inputs?.includes(status?.inputName || 'BELABOX_SRT') && <option value={status?.inputName || 'BELABOX_SRT'}>{status?.inputName || 'BELABOX_SRT'}</option>}{(status?.inputs || []).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      <p>El mute afecta únicamente al sonido del campo. La imagen SRT y el audio publicitario continúan.</p>
    </details>
  </section>;
}
