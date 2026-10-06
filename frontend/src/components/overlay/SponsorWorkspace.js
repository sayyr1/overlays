import React, { useEffect, useRef, useState } from 'react';
import './sponsor-workspace.css';

function BrandLogo({ sponsor }) {
  return <div className="brand-avatar">{sponsor.logo?.secureUrl ? <img src={sponsor.logo.secureUrl} alt="" /> : <span>{sponsor.name.slice(0, 2).toUpperCase()}</span>}</div>;
}

async function uploadVideo(file, name, api) {
  if (!/\.(mp4|webm)$/i.test(file.name) || file.size > 100 * 1024 * 1024) throw new Error('Usa MP4 o WebM de hasta 100 MB.');
  const signed = await api('/media/sign', { method: 'POST', body: JSON.stringify({ kind: 'video' }) });
  const body = new FormData();
  Object.entries(signed.params).forEach(([key, value]) => body.append(key, String(value)));
  body.append('api_key', signed.apiKey); body.append('signature', signed.signature); body.append('file', file);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/video/upload`, { method: 'POST', body });
  const uploaded = await response.json();
  if (!response.ok) throw new Error(uploaded.error?.message || 'No se pudo subir el video.');
  return api('/media', { method: 'POST', body: JSON.stringify({ publicId: uploaded.public_id, kind: 'video', category: 'sponsors', name }) });
}

export function SponsorLibrary({ api, apiBase, onSaved }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [assets, setAssets] = useState([]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    api('/sponsors').then(data => { if (current) { setBrands(data); setError(''); } }).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [api, revision]);
  useEffect(() => { let current = true; api('/media').then(data => { if (current) setAssets(data); }).catch(() => {}); return () => { current = false; }; }, [api]);
  const save = async event => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      let logo = editor.logo;
      let mediaVideo = form.get('mediaVideo') || null;
      const file = form.get('logo');
      const video = form.get('video');
      const name = String(form.get('name') || '').trim() || file?.name?.replace(/\.[^.]+$/, '') || video?.name?.replace(/\.[^.]+$/, '');
      if (!name) throw new Error('Escribe el nombre o sube un logo o video.');
      if (file?.size) {
        if (file.size > 5 * 1024 * 1024) throw new Error('El logo puede pesar hasta 5 MB.');
        const body = new FormData(); body.append('file', file); body.append('folder', 'auspiciantes');
        const response = await fetch(`${apiBase}/api/sports/upload`, { method: 'POST', credentials: 'include', body });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'No se pudo subir el logo.');
        logo = data;
      }
      if (video?.size) mediaVideo = (await uploadVideo(video, name, api))._id;
      const body = { name, logo, mediaVideo, mediaLogo: form.get('mediaLogo') || null, mediaMotion: form.get('mediaMotion') || null, videoMuted: form.get('videoMuted') === 'on' };
      ['category', 'headline', 'description', 'location', 'phone', 'url', 'backgroundColor', 'textColor', 'accentColor'].forEach(key => { body[key] = form.get(key); });
      await api(editor._id ? `/sponsors/${editor._id}` : '/sponsors', { method: editor._id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setEditor(null); setRevision(n => n + 1); setMessage('Marca guardada en tu biblioteca.');
      await onSaved?.();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const filtered = brands.filter(b => `${b.name} ${b.category || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="brand-workspace">
    <div className="section-heading"><div><span className="eyebrow">BIBLIOTECA COMPARTIDA</span><h2>Tus marcas, siempre disponibles</h2><p>Crea una vez. Elige en qué eventos participan desde la configuración de cada evento.</p></div>{editor === null && <button onClick={() => { setEditor({}); setError(''); setMessage(''); }}>+ Nuevo auspiciante</button>}</div>
    {error && <p role="alert" className="brand-error">{error}</p>}
    {message && <p role="status" className="brand-feedback">{message}</p>}
    {editor !== null ? <section className="brand-editor">
      <div className="section-heading"><div><h3>{editor._id ? `Editar ${editor.name}` : 'Crear auspiciante'}</h3><p>Logo, anuncio y datos comerciales de la marca. Puedes asignarla a eventos después.</p></div><button type="button" className="outline" disabled={busy} onClick={() => setEditor(null)}>Volver a la biblioteca</button></div>
      <form onSubmit={save} key={editor._id || 'new'}><fieldset disabled={busy}>
        <div className="brand-form-grid">
          <section><h4>01 · Identidad y piezas</h4><label>Nombre comercial<input name="name" defaultValue={editor.name} maxLength={90} placeholder="Opcional si subes un archivo" /></label><label>Etiqueta comercial<input name="category" defaultValue={editor.category} maxLength={60} placeholder="Ej. Auspiciante oficial" /></label>
            <label className="brand-upload">Logo<input name="logo" type="file" accept=".png,.jpg,.jpeg,.webp,.svg" /><small>PNG, JPG, WebP o SVG · Hasta 5 MB. Crea el gráfico automáticamente.</small></label>
            {editor.logo?.secureUrl && <BrandLogo sponsor={editor} />}
            <label className="brand-upload">Video publicitario<input name="video" type="file" accept=".mp4,.webm" /><small>MP4 o WebM · Hasta 100 MB{editor.mediaVideo ? ' · Ya tienes un video guardado' : ''}</small></label>
            <label className="brand-check"><input name="videoMuted" type="checkbox" defaultChecked={editor.videoMuted === true} />Silenciar audio del video</label>
            <details><summary>Usar piezas de la biblioteca de archivos</summary>{[['mediaLogo', 'Logo de biblioteca', 'image'], ['mediaMotion', 'Animación WebM', 'motion'], ['mediaVideo', 'Video de biblioteca', 'video']].map(([field, label, kind]) => <label key={field}>{label}<select name={field} defaultValue={editor[field] || ''}><option value="">{field === 'mediaLogo' ? 'Usar el logo subido' : 'Sin pieza asignada'}</option>{editor[field] && !assets.some(a => a._id === editor[field]) && <option value={editor[field]}>Pieza guardada</option>}{assets.filter(a => kind === 'motion' ? a.format === 'webm' : a.kind === kind).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}</select></label>)}</details>
          </section>
          <section><h4>02 · Mensaje y presentación</h4><label>Titular<input name="headline" defaultValue={editor.headline} maxLength={150} /></label><label>Mensaje comercial<textarea name="description" defaultValue={editor.description} maxLength={260} /></label>
            <div className="brand-colors">{[['backgroundColor', 'Fondo', '#101720'], ['textColor', 'Texto', '#ffffff'], ['accentColor', 'Acento', '#e0b84d']].map(([key, label, fallback]) => <label key={key}>{label}<input type="color" name={key} defaultValue={editor[key] || fallback} /></label>)}</div>
            <details><summary>Datos de contacto opcionales</summary>{[['location', 'Dirección', 180], ['phone', 'Teléfono', 80], ['url', 'Web o red social', 180]].map(([key, label, max]) => <label key={key}>{label}<input name={key} defaultValue={editor[key]} maxLength={max} /></label>)}</details>
          </section>
        </div><div className="brand-form-footer"><p>Los cambios de la marca se comparten con los eventos donde está asignada.</p><button>{busy ? 'Guardando…' : 'Guardar auspiciante'}</button></div>
      </fieldset></form>
    </section> : <>
      <div className="brand-toolbar"><label>Buscar auspiciante<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o etiqueta" /></label><span>{brands.length} marcas en la biblioteca</span></div>
      {loading ? <p role="status">Cargando biblioteca…</p> : filtered.length ? <div className="brand-card-grid">{filtered.map(brand => <article className="brand-card" key={brand._id}><BrandLogo sponsor={brand} /><h3>{brand.name}</h3><p>{brand.category || 'Marca comercial'}</p><div className="brand-tags"><span>{brand.logo?.secureUrl || brand.mediaLogo ? 'Logo disponible' : 'Sin logo'}</span>{brand.mediaVideo && <span>Video · {brand.videoMuted ? 'sin audio' : 'con audio'}</span>}</div><button className="outline" onClick={() => { setEditor(brand); setError(''); setMessage(''); }}>Editar marca</button></article>)}</div> : <div className="brand-empty"><h3>{search ? 'No encontramos esa marca' : 'Tu biblioteca empieza aquí'}</h3><p>{search ? 'Prueba otro nombre o etiqueta.' : 'Sube un logo o video para crear tu primer auspiciante. No necesitas tener un evento creado.'}</p>{!search && <button onClick={() => setEditor({})}>Crear primer auspiciante</button>}</div>}
    </>}
  </section>;
}

export function EventSponsors({ tournament, sponsors, api, onSaved, onOpenLibrary }) {
  const [library, setLibrary] = useState([]);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(sponsors.length ? 'assigned' : 'choose');
  useEffect(() => { if (sponsors.length) setView('assigned'); }, [sponsors.length]);
  useEffect(() => { let current = true; api('/sponsors').then(data => { if (current) setLibrary(data); }).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); }); return () => { current = false; }; }, [api]);
  const run = async task => { setBusy(true); setError(''); try { await task(); await onSaved(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const available = library.filter(b => !sponsors.some(s => s._id === b._id) && b.name.toLowerCase().includes(search.toLowerCase()));
  return <section className="event-sponsors resource" data-mobile-view={view}>
    <div className="section-heading"><div><span className="eyebrow">PAUTA DE ESTE EVENTO</span><h2>Auspiciantes de {tournament.name}</h2><p>Elige marcas de tu biblioteca. La confirmación, duración y orden pertenecen a este evento.</p></div><button className="outline" onClick={onOpenLibrary}>Administrar biblioteca</button></div>
    {error && <p role="alert" className="brand-error">{error}</p>}
    <nav className="mobile-assignment-nav" aria-label="Auspiciantes del evento"><button className={view === 'assigned' ? '' : 'outline'} aria-pressed={view === 'assigned'} onClick={() => setView('assigned')}>Asignados ({sponsors.length})</button><button className={view === 'choose' ? '' : 'outline'} aria-pressed={view === 'choose'} onClick={() => setView('choose')}>Agregar marcas</button></nav>
    <fieldset disabled={busy}>
      <div className="event-brand-columns"><section><h3>Elegir de la biblioteca</h3><label>Buscar marca<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre comercial" /></label>
        {loading ? <p>Cargando marcas…</p> : available.length ? <div className="brand-choice-list">{available.map(brand => <label className="brand-choice" key={brand._id}><input type="checkbox" checked={selection.includes(brand._id)} onChange={e => setSelection(ids => e.target.checked ? [...ids, brand._id] : ids.filter(id => id !== brand._id))} /><BrandLogo sponsor={brand} /><span>{brand.name}<small>{brand.mediaVideo ? 'Logo / video' : 'Gráfico de marca'}</small></span></label>)}</div> : <p className="brand-muted">{library.length ? 'No hay más marcas disponibles con esta búsqueda.' : 'Crea auspiciantes en la biblioteca para poder elegirlos aquí.'}</p>}
        <div className="brand-selection-footer"><span role="status">{selection.length ? `${selection.length} ${selection.length === 1 ? 'marca seleccionada' : 'marcas seleccionadas'}` : 'Selecciona las marcas para este evento'}</span><button disabled={!selection.length || busy} onClick={() => run(async () => { await api(`/tournaments/${tournament._id}/sponsors`, { method: 'POST', body: JSON.stringify({ sponsorIds: selection }) }); setSelection([]); setView('assigned'); })}>Agregar seleccionados{selection.length ? ` (${selection.length})` : ''}</button></div>
      </section><section><h3>Asignados a este evento <span className="brand-count">{sponsors.length}</span></h3><p className="brand-muted">Solo los confirmados y activos están disponibles para emisión.</p>
        {sponsors.length ? sponsors.map(sponsor => <Assignment key={`${sponsor._id}-${sponsor.confirmed}-${sponsor.active}-${sponsor.order}-${sponsor.durationSeconds}`} sponsor={sponsor} busy={busy} onSave={values => run(() => api(`/tournaments/${tournament._id}/sponsors/${sponsor._id}`, { method: 'PUT', body: JSON.stringify(values) }))} onRemove={() => { if (window.confirm(`¿Retirar a ${sponsor.name} de este evento? La marca seguirá disponible en la biblioteca.`)) run(() => api(`/sponsors/${sponsor._id}/assignments/${tournament._id}`, { method: 'DELETE' })); }} />) : <div className="brand-empty"><h4>Aún no hay auspiciantes asignados</h4><p>Selecciona una o varias marcas y agrégalas a este evento.</p></div>}
      </section></div>
    </fieldset>
  </section>;
}

function Assignment({ sponsor, onSave, onRemove, busy }) {
  const [values, setValues] = useState({ confirmed: sponsor.confirmed !== false, active: sponsor.active !== false, order: sponsor.order || 0, durationSeconds: sponsor.durationSeconds || 10 });
  const dirty = useRef(false);
  const set = (key, value) => { dirty.current = true; setValues(v => ({ ...v, [key]: value })); };
  return <article className="assignment-card"><div className="assignment-heading"><BrandLogo sponsor={sponsor} /><div><h4>{sponsor.name}</h4><span className={`assignment-status ${sponsor.confirmed && sponsor.active ? 'ready' : ''}`}>{sponsor.confirmed ? sponsor.active ? 'Listo para emitir' : 'Pausado' : 'Pendiente de confirmación'}</span></div></div>
    <div className="assignment-fields"><label className="brand-check"><input type="checkbox" checked={values.confirmed} onChange={e => set('confirmed', e.target.checked)} />Confirmado</label><label className="brand-check"><input type="checkbox" checked={values.active} onChange={e => set('active', e.target.checked)} />Activo</label><label>Duración (s)<input type="number" min={3} max={120} value={values.durationSeconds} onChange={e => set('durationSeconds', Number(e.target.value))} /></label><label>Orden<input type="number" min={0} value={values.order} onChange={e => set('order', Number(e.target.value))} /></label></div>
    <div className="assignment-actions"><button className="outline" disabled={busy || !dirty.current || values.durationSeconds < 3 || values.durationSeconds > 120 || values.order < 0} onClick={() => onSave(values)}>Guardar participación</button><button className="link danger-link" onClick={onRemove}>Retirar del evento</button></div>
  </article>;
}
