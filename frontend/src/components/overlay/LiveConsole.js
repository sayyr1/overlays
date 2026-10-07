import React, { useCallback, useEffect, useRef, useState } from 'react';
import ControlIcon from './ControlIcon';
import { sponsorPlayback } from '../../utils/sponsorPlayback';
import './live-console.css';

const defaults = ['goal_home', 'goal_away', 'clock', 'logos', 'ads', 'replay_save', 'mute', 'replay_stop'];
const generalDefaults = ['logos', 'ads', 'replay_save', 'mute', 'replay_stop', 'graphics', 'output'];

export default function LiveConsole({ tournament, snapshot, sponsors = [], api, onSnapshot, onNavigate }) {
  const [output, setOutput] = useState(null);
  const [obs, setObs] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [customize, setCustomize] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(null);
  const [connectionError, setConnectionError] = useState('');
  const general = tournament.mode && tournament.mode !== 'sports';
  const storageKey = `overlay-favorites:${tournament._id}`;
  const [favorites, setFavorites] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (Array.isArray(saved)) return [...new Set(saved.filter(id => [...defaults, ...generalDefaults, 'stop_ads', 'scoreboard'].includes(id)))].slice(0, 8); } catch { /* First use or storage unavailable. */ }
    return general ? generalDefaults : defaults;
  });
  const operation = useRef(0);
  const working = useRef(false);
  const refresh = useCallback(async () => {
    if (working.current) return;
    const version = ++operation.current;
    try {
      const [program, audio] = await Promise.all([api('/obs/output'), api('/obs/audio')]);
      if (version === operation.current) { setOutput(program); setObs(audio); setNow(Date.now()); setOnline(true); setConnectionError(''); }
    } catch (e) { if (version === operation.current) { setOnline(false); setConnectionError(e.message); } }
  }, [api]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 4000); return () => { clearInterval(timer); operation.current += 1; }; }, [refresh]);
  const assigned = output?.tournament?.id === tournament._id && output.tournament.active !== false;
  const overlayConfirmed = online && output?.stateConfirmed && (!assigned || (snapshot?.revision ?? 0) <= output.seenStateRevision);
  const playback = sponsorPlayback(output?.sponsorDeck, now);
  const remotePending = Boolean(obs?.pending || obs?.replay?.pending);
  const locked = Boolean(busy || remotePending || online !== true);
  const match = snapshot?.match;
  const brands = sponsors.filter(s => s.active !== false && s.confirmed !== false);
  const definitions = [
    ...(!general ? [
      { id: 'goal_home', label: 'Gol local', icon: 'match', detail: `${match?.homeTeam?.shortName || match?.homeTeam?.name || 'Local'} · ${match?.score?.home || 0}`, disabled: !assigned || !match },
      { id: 'goal_away', label: 'Gol visitante', icon: 'match', detail: `${match?.awayTeam?.shortName || match?.awayTeam?.name || 'Visitante'} · ${match?.score?.away || 0}`, disabled: !assigned || !match },
      { id: 'clock', label: match?.clock?.running ? 'Pausar reloj' : 'Iniciar reloj', icon: 'capture', detail: match?.clock?.period || 'Tiempo de juego', active: assigned && match?.clock?.running, disabled: !assigned || !match },
      { id: 'scoreboard', label: 'Marcador', icon: 'graphics', detail: snapshot?.graphics?.scoreboardVisible ? 'Visible' : 'Oculto', active: assigned && snapshot?.graphics?.scoreboardVisible, disabled: !assigned || !match },
    ] : []),
    { id: 'logos', label: 'Rotar logos', icon: 'replay', detail: 'Sin audio', active: assigned && playback.active && playback.mode === 'logos', disabled: !assigned || !brands.some(s => s.logo?.secureUrl || s.mediaLogo) },
    { id: 'ads', label: 'Tanda de anuncios', icon: 'ads', detail: 'Videos del evento', active: assigned && playback.active && playback.mode === 'ads', disabled: !assigned || !brands.some(s => s.mediaVideo) },
    { id: 'stop_ads', label: 'Ocultar publicidad', icon: 'back', detail: 'Detener pauta', danger: true, disabled: !assigned || !playback.active },
    { id: 'replay_save', label: 'Guardar jugada', icon: 'save', detail: 'Búfer de OBS', disabled: !assigned || !obs?.connected || !obs?.replay?.bufferActive || Boolean(obs?.replay?.playingClipId) },
    { id: 'replay_stop', label: 'Volver al directo', icon: 'back', detail: 'Salir de repetición', active: Boolean(obs?.replay?.playingClipId), disabled: !obs?.connected || !obs?.replay?.playingClipId },
    { id: 'mute', label: obs?.muted ? 'Activar campo' : 'Silenciar campo', icon: 'audio', detail: obs?.muted ? 'Campo silenciado' : 'Audio BELABOX', danger: obs?.muted, active: obs?.muted, disabled: !obs?.connected || obs?.sourceAvailable === false },
    { id: 'graphics', label: 'Gráficos', icon: 'graphics', detail: 'Preparar y emitir', navigate: 'graphics' },
    { id: 'output', label: 'Salida OBS', icon: 'output', detail: 'Vista previa', navigate: 'output' },
  ];
  const run = async (id, task) => {
    if (working.current) return;
    working.current = true; operation.current++; setBusy(id); setError(''); setMessage('');
    try { await task(); }
    catch (e) { setError(e.message); }
    finally { working.current = false; setBusy(''); await refresh(); }
  };
  const assign = () => run('assign', async () => {
    const next = await api('/obs/output/event', { method: 'PUT', body: JSON.stringify({ tournamentId: tournament._id, expectedRevision: output.revision }) });
    setOutput(next); setConfirmSwitch(false); setMessage('Evento asignado. Esperando confirmación del overlay.');
  });
  const press = item => {
    if (item.navigate) return onNavigate(item.navigate);
    run(item.id, async () => {
      let result;
      if (['logos', 'ads', 'stop_ads'].includes(item.id)) {
        result = await api(`/tournaments/${tournament._id}/sponsors/control`, { method: 'POST', body: JSON.stringify({ action: item.id === 'stop_ads' ? 'stop' : item.id }) });
      } else if (['replay_save', 'replay_stop'].includes(item.id)) {
        result = await api('/obs/replay/control', { method: 'POST', body: JSON.stringify({ action: item.id === 'replay_save' ? 'save' : 'stop', tournamentId: tournament._id }) }); setObs(result);
      } else if (item.id === 'mute') {
        result = await api('/obs/audio', { method: 'PATCH', body: JSON.stringify({ muted: !obs.muted }) }); setObs(result);
      } else {
        const action = item.id === 'clock' ? match.clock.running ? 'clock_pause' : 'clock_start' : item.id;
        const extra = item.id === 'scoreboard' ? { visible: !snapshot.graphics.scoreboardVisible } : item.id.startsWith('goal_') ? { teamName: item.id === 'goal_home' ? match.homeTeam?.name : match.awayTeam?.name } : {};
        result = await api(`/matches/${match.id}/control`, { method: 'POST', body: JSON.stringify({ action, ...extra }) });
      }
      if (result?.snapshot) onSnapshot(result.snapshot);
      setMessage(result?.pending || result?.replay?.pending ? 'Orden enviada. Esperando confirmación de casa.' : 'Cambio guardado. Esperando confirmación del overlay.');
    });
  };
  const toggle = id => {
    const next = favorites.includes(id) ? favorites.filter(value => value !== id) : favorites.length < 8 ? [...favorites, id] : favorites;
    setFavorites(next); try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Session still works. */ }
  };
  return <>
    <section className={`program-status ${assigned ? 'is-assigned' : ''}`} aria-label="Estado de la salida fija">
      <div><span className="program-caption">SALIDA FIJA DE OBS</span><strong>{output?.tournament?.name || (output ? 'Sin evento asignado' : 'Consultando salida…')}</strong></div>
      <div className="program-signals" role="status"><span className={online && obs?.connected ? 'is-ready' : ''}>{online === false ? 'Sin conexión con la web' : obs?.connected ? 'OBS conectado' : obs ? 'OBS sin conexión' : 'Comprobando OBS'}</span><span className={online && output?.connected ? 'is-ready' : ''}>{online === false ? 'Estado sin actualizar' : output?.connected ? overlayConfirmed ? 'Overlay confirmado' : 'Overlay actualizando' : 'Enlace fijo sin señal'}</span></div>
      <div className="program-now" role="status">{online === false ? 'Reconectando…' : obs?.replay?.playingClipId ? '● Repetición en aire' : playback.active ? `● ${playback.mode === 'logos' ? 'Logo' : 'Anuncio'} · ${playback.item.name}` : assigned && output?.applied ? '● Directo' : 'Esperando salida'}{obs?.muted && <span>Campo silenciado</span>}</div>
      {output && !assigned && <div className="program-assignment"><p>Estás preparando <strong>{tournament.name}</strong>. La salida no cambia al abrir otro evento.</p>{!confirmSwitch ? <button disabled={locked || !output} onClick={() => output?.tournament ? setConfirmSwitch(true) : assign()}>Enviar este evento a OBS</button> : <div><p>¿Cambiar la salida de <strong>{output.tournament.name}</strong> a <strong>{tournament.name}</strong>?</p><button className="outline" disabled={Boolean(busy)} onClick={() => setConfirmSwitch(false)}>Cancelar</button><button disabled={locked} onClick={assign}>Confirmar cambio de evento</button></div>}</div>}
      {(busy || remotePending || message) && <p className="program-feedback" role="status">{busy ? 'Enviando…' : remotePending ? 'Orden enviada · esperando confirmación de casa' : overlayConfirmed && assigned ? 'Overlay confirmado' : message}</p>}
      {error && <p className="brand-error" role="alert">{error}</p>}
      {connectionError && <p className="brand-error" role="alert">{connectionError}</p>}
    </section>
    <section className="favorite-deck" aria-label="Teclas favoritas"><header><div><span className="eyebrow">CONTROL RÁPIDO</span><h2>Mis teclas</h2></div><button className="outline" onClick={() => setCustomize(!customize)} aria-expanded={customize}>Editar teclas</button></header>
      {customize && <div className="favorite-editor"><p>Elige hasta 8 acciones. Se guardan en este dispositivo para este evento.</p>{definitions.map(item => <label key={item.id}><input type="checkbox" checked={favorites.includes(item.id)} disabled={!favorites.includes(item.id) && favorites.length >= 8} onChange={() => toggle(item.id)} />{item.label}</label>)}</div>}
      <div className="favorite-grid">{favorites.map(id => definitions.find(item => item.id === id)).filter(Boolean).map(item => <button key={item.id} className={`favorite-pad ${item.active ? 'is-active' : ''} ${item.danger ? 'is-danger' : ''}`} aria-pressed={['clock', 'logos', 'mute', 'scoreboard'].includes(item.id) ? Boolean(item.active) : undefined} disabled={!item.navigate && (locked || item.disabled)} onClick={() => press(item)}><ControlIcon name={item.icon} /><strong>{item.label}</strong><small>{busy === item.id ? 'Enviando…' : item.detail}</small></button>)}</div>
      {!favorites.length && <p>Elige tus acciones en “Editar teclas”.</p>}
    </section>
  </>;
}
