import React, { useState } from 'react';
import './studio.css';

const types = { opening: 'Inicio', break: 'Pausa', ending: 'Cierre', countdown: 'Cuenta regresiva', speaker: 'Nombre e invitado', topic: 'Tema', location: 'Ubicación', social: 'Redes y contacto', announcement: 'Aviso' };
const layerFor = type => ['opening', 'break', 'ending', 'countdown'].includes(type) ? 'main' : type === 'announcement' ? 'temporary' : 'lower';

export function BroadcastControls({ snapshot, send, busy = false }) {
  const scenes = snapshot?.broadcast?.scenes || [];
  const graphics = snapshot?.graphics || {};
  return <section className="broadcast-controls">
    <h2>Tu biblioteca de transmisión</h2>
    <p>Emite tus gráficos guardados. Los nombres y temas aparecen sobre la cámara; inicio, pausa y cierre ocupan una placa central.</p>
    <div className="broadcast-scenes">
      {scenes.map(scene => {
        const layer = layerFor(scene.type);
        const current = graphics[layer === 'lower' ? 'lowerThird' : layer];
        const active = current?.data?.sceneId === scene.id && (!current?.expiresAt || new Date(current.expiresAt).getTime() > Date.now());
        return <button key={scene.id} disabled={busy || !scene.title?.trim()} className={active ? 'broadcast-on-air' : 'outline'} onClick={() => send(active ? 'hide' : 'take', active ? { layer } : { sceneId: scene.id })}>
          <small>{active ? 'EN AIRE · RETIRAR' : !scene.title?.trim() ? 'COMPLETAR EN CONFIGURACIÓN' : types[scene.type]}</small>
          <strong>{scene.label}</strong><span>{scene.title || 'Falta el texto'}</span>
        </button>;
      })}
    </div>
    <div className="broadcast-actions">
      <button className="outline" disabled={busy} onClick={() => send('hide', { layer: 'main' })}>Volver a cámara</button>
      <button className="outline" disabled={busy} onClick={() => send('hide', { layer: 'lower' })}>Retirar nombre / tema</button>
      <button className="outline" disabled={busy} onClick={() => send('hide', { layer: 'temporary' })}>Retirar aviso</button>
      <button className="outline" disabled={busy || !snapshot?.sponsors?.length} onClick={() => send('sponsors', { visible: !graphics.sponsorBugVisible })}>{graphics.sponsorBugVisible ? 'Ocultar auspiciantes' : 'Mostrar auspiciantes'}</button>
      <button className="danger" disabled={busy} onClick={() => send('clear')}>Limpiar salida</button>
    </div>
    {busy && <p role="status">Enviando a la transmisión…</p>}
  </section>;
}

export function BroadcastEditor({ tournament, api, onSaved, onCreated }) {
  const [scenes, setScenes] = useState(tournament.broadcast?.scenes || []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [copyName, setCopyName] = useState('');
  const change = (id, values) => { setDirty(true); setScenes(list => list.map(scene => scene.id === id ? { ...scene, ...values } : scene)); };
  const save = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await api(`/tournaments/${tournament._id}/broadcast`, { method: 'PUT', body: JSON.stringify({ scenes }) });
      setDirty(false); await onSaved(); setMessage('Biblioteca guardada. Los cambios se aplican cuando vuelvas a emitir el gráfico.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const duplicate = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await api('/tournaments', { method: 'POST', body: JSON.stringify({ name: copyName, mode: tournament.mode, colors: tournament.colors, logo: tournament.logo, broadcast: { scenes } }) });
      onCreated(result); await onSaved();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <section className="broadcast-editor">
    <h2>Preparar una vez, reutilizar después</h2>
    <p>Personaliza las plantillas y guárdalas para esta transmisión. No necesitas crear un partido. Puedes dejar vacíos los gráficos que no vayas a usar.</p>
    <form onSubmit={save}>
      <fieldset disabled={busy}>
        <div className="broadcast-editor-grid">{scenes.map(scene => <section className="broadcast-edit-card" key={scene.id}>
          <label>Nombre del botón<input required maxLength={60} value={scene.label} onChange={e => change(scene.id, { label: e.target.value })} /></label>
          <label>Diseño<select value={scene.type} onChange={e => change(scene.id, { type: e.target.value })}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Texto principal<input maxLength={100} value={scene.title} onChange={e => change(scene.id, { title: e.target.value })} placeholder="Nombre, tema, lugar o mensaje" /></label>
          <label>Texto secundario<input maxLength={180} value={scene.subtitle} onChange={e => change(scene.id, { subtitle: e.target.value })} placeholder="Cargo, descripción o contacto" /></label>
          {scene.type === 'countdown' && <label>Cuenta regresiva (segundos)<input type="number" required min={1} max={3600} value={scene.seconds} onChange={e => change(scene.id, { seconds: Number(e.target.value) })} /></label>}
          <label>Ocultar después de (segundos; 0 = manual)<input type="number" required min={0} max={3600} value={scene.duration} onChange={e => change(scene.id, { duration: Number(e.target.value) })} /></label>
          <button type="button" className="outline" onClick={() => { setScenes(list => list.filter(item => item.id !== scene.id)); setDirty(true); }}>Eliminar de biblioteca</button>
        </section>)}</div>
        <div className="broadcast-actions">
          <button type="button" className="outline" disabled={scenes.length >= 30} onClick={() => { setScenes(list => [...list, { id: crypto.randomUUID(), type: 'speaker', label: 'Nuevo gráfico', title: '', subtitle: '', duration: 0, seconds: 300 }]); setDirty(true); }}>Agregar gráfico</button>
          <button type="submit">{dirty ? 'Guardar cambios' : 'Guardar biblioteca'}</button>
        </div>
      </fieldset>
    </form>
    {message && <p role="status">{message}</p>}
    <form className="broadcast-copy" onSubmit={duplicate}>
      <h3>Reutilizar para otra ocasión</h3>
      <p>Crea una transmisión con estos textos, diseños y marca. Su salida empieza vacía; los auspiciantes se configuran aparte.</p>
      <label>Nombre de la nueva transmisión<input required maxLength={120} value={copyName} onChange={e => setCopyName(e.target.value)} /></label>
      <button disabled={busy || dirty}>Duplicar preparación</button>
      {dirty && <small>Guarda los cambios antes de duplicar.</small>}
    </form>
  </section>;
}

export function TransmissionFields() {
  return <>
    <label>Tipo de transmisión<select name="mode" defaultValue="sports"><option value="sports">Deportes</option><option value="presentation">Presentación / entrevista</option><option value="irl">IRL / en exteriores</option><option value="general">General</option></select></label>
    <input name="name" aria-label="Nombre de la transmisión" placeholder="Nombre de la transmisión" maxLength={120} required />
    <input name="season" aria-label="Edición o temporada" placeholder="Edición o temporada (opcional)" />
    <input name="slug" aria-label="Nombre del enlace" placeholder="Nombre del enlace (opcional)" />
  </>;
}
