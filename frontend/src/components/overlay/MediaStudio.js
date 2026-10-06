import React, { useEffect, useState } from 'react';
import { mediaTiming } from './MediaComposition';
import './media.css';

const categories = { images: 'Imágenes', videos: 'Videos', motion: 'Motion graphics', logos: 'Logos', sponsors: 'Auspiciantes', backgrounds: 'Fondos' };
const defaults = { x: 0, y: 0, width: 1920, height: 1080, opacity: 1, zIndex: 20, duration: 0, fit: 'contain', loop: false, muted: true, endBehavior: 'hide', title: '', subtitle: '', textDelay: 0, textX: 40, textY: 40, fontSize: 44 };
const layouts = {
  full: { label: 'Pantalla completa', x: 0, y: 0, width: 1920, height: 1080, zIndex: 20 },
  background: { label: 'Fondo / frame', x: 0, y: 0, width: 1920, height: 1080, zIndex: 1 },
  lower: { label: 'Lower third', x: 96, y: 820, width: 1100, height: 180, zIndex: 20 },
  logo: { label: 'Logo superior', x: 1520, y: 64, width: 300, height: 160, zIndex: 30 },
};

export default function MediaStudio({ tournament, snapshot, api, onSnapshot, sponsors = [], onSaved, preview }) {
  const [assets, setAssets] = useState([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [assetId, setAssetId] = useState('');
  const [slot, setSlot] = useState('0');
  const [config, setConfig] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('images');
  const [name, setName] = useState('');
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { let current = true; api('/media').then(data => { if (current) setAssets(data); }).catch(e => { if (current) setMessage(e.message); }); return () => { current = false; }; }, [api]);
  useEffect(() => { let current = true; api('/media-presets').then(data => { if (current) setPresets(data); }).catch(e => { if (current) setMessage(e.message); }); return () => { current = false; }; }, [api]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const run = async fn => { setBusy(true); setMessage(''); try { await fn(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } };
  const control = (action, targetSlot = slot, extra = {}) => run(async () => {
    const result = await api(`/tournaments/${tournament._id}/media/control`, { method: 'POST', body: JSON.stringify({ action, slot: targetSlot, assetId, config, ...extra }) });
    onSnapshot(result.snapshot);
  });
  const upload = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    await run(async () => {
      const ext = file.name.split('.').pop().toLowerCase();
      const kind = ['webm', 'mp4'].includes(ext) ? 'video' : 'image';
      if (!['png', 'webp', 'svg', 'jpg', 'jpeg', 'webm', 'mp4'].includes(ext)) throw new Error('Usa PNG, WebP, SVG, JPG, WebM o MP4.');
      if (category === 'motion' && ext !== 'webm') throw new Error('Selecciona un WebM para motion graphics.');
      if (file.size > (kind === 'video' ? 100 : 10) * 1024 * 1024) throw new Error('Máximo: imágenes 10 MB; videos 100 MB.');
      const signed = await api('/media/sign', { method: 'POST', body: JSON.stringify({ kind }) });
      const body = new FormData();
      Object.entries(signed.params).forEach(([key, value]) => body.append(key, String(value)));
      body.append('api_key', signed.apiKey); body.append('signature', signed.signature); body.append('file', file);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/${kind}/upload`, { method: 'POST', body });
      const uploaded = await response.json();
      if (!response.ok) throw new Error(uploaded.error?.message || 'No se pudo subir el archivo.');
      const asset = await api('/media', { method: 'POST', body: JSON.stringify({ publicId: uploaded.public_id, kind, category, name: name.trim() || file.name }) });
      setAssets(list => [asset, ...list.filter(item => item._id !== asset._id)]); setAssetId(asset._id); setName('');
      setMessage('Recurso guardado y disponible para todas las transmisiones.');
    });
  };
  const set = (key, value) => setConfig(c => ({ ...c, [key]: value }));
  const active = layer => {
    if (!layer?.visible || !layer.config) return false;
    const timing = mediaTiming(layer, now);
    return !timing.expired && !(layer.playing !== false && timing.ended && layer.config.endBehavior === 'hide');
  };
  return <details className="media-studio">
    <summary>Media y motion graphics · Biblioteca, capas y auspiciantes</summary>
    <header className="media-heading"><div><span className="eyebrow">COMPOSITOR · MEDIA</span><h2>Biblioteca y capas</h2><p>Los mismos recursos para deportes, podcast, IRL y eventos.</p></div><span className="media-count">{assets.length} recursos</span></header>
    {message && <p role="status" className="media-message">{message}</p>}
    <fieldset disabled={busy}>
      <div className="media-presets"><h3>Presets compartidos</h3><div className="media-actions">{presets.map(p => <button className="outline" key={p._id} disabled={!assets.some(a => a._id === p.assetId)} onClick={() => { setAssetId(p.assetId); setConfig(p.config); setMessage(`Preset ${p.name} preparado. Pulsa Mostrar para emitirlo.`); }}>{p.name}</button>)}</div><div className="media-upload"><label>Nombre del preset<input maxLength={90} value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Ej. Podcast · Invitado" /></label><button disabled={!assetId || !presetName.trim()} onClick={() => run(async () => { const preset = await api('/media-presets', { method: 'POST', body: JSON.stringify({ name: presetName, assetId, config }) }); setPresets(list => [preset, ...list]); setPresetName(''); setMessage('Preset guardado para todas las transmisiones.'); })}>Guardar configuración como preset</button></div></div>
      <div className="media-upload"><label>Nombre del recurso<input value={name} maxLength={90} onChange={e => setName(e.target.value)} placeholder="Ej. Entrada invitado" /></label><label>Categoría<select value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="media-file">{busy ? 'Procesando…' : 'Subir archivo'}<input type="file" accept=".png,.webp,.svg,.jpg,.jpeg,.webm,.mp4" onChange={upload} /></label></div>
      <small>Imágenes hasta 10 MB · Videos hasta 100 MB · Para transparencia, usa WebM exportado con canal alfa.</small>
      <div className="media-browser"><label>Buscar<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre del recurso" /></label><label>Filtrar<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">Todas las categorías</option>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <div className="media-assets">{assets.filter(a => (!filter || a.category === filter) && a.name.toLowerCase().includes(search.toLowerCase())).map(asset => <button type="button" key={asset._id} className={`media-asset ${assetId === asset._id ? 'is-selected' : ''}`} aria-pressed={assetId === asset._id} onClick={() => { setAssetId(asset._id); if (asset.builtin) setConfig({ ...defaults, ...(asset._id === 'builtin-studio-lower' ? layouts.lower : layouts.background) }); }}><div className="media-thumbnail">{asset.kind === 'image' ? <img src={asset.secureUrl} alt="" loading="lazy" /> : <span>{asset.format === 'webm' ? '◈ WEBM' : '▶ MP4'}</span>}</div><strong>{asset.name}</strong><small>{categories[asset.category]} · {asset.width} × {asset.height}</small></button>)}</div>
      {!assets.length && <p className="media-empty">Sube un logo, frame o animación para preparar tu primera capa.</p>}
      <div className="media-editor">
        <div className="media-fields"><label>Capa<select value={slot} onChange={e => { const value = e.target.value; setSlot(value); const layer = snapshot?.mediaLayers?.[value]; if (layer?.config) { setConfig(layer.config); setAssetId(layer.assetId); } }}>{Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>Capa {i + 1}{i === 15 ? ' · Sponsor' : ''}</option>)}</select></label><label>Distribución<select defaultValue="" onChange={e => { const { label, ...values } = layouts[e.target.value]; setConfig(c => ({ ...c, ...values })); }}><option value="" disabled>Aplicar distribución…</option>{Object.entries(layouts).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          {[["x", "Posición X", -1920, 1920], ["y", "Posición Y", -1080, 1080], ["width", "Ancho", 1, 3840], ["height", "Alto", 1, 2160], ["opacity", "Opacidad", 0, 1], ["zIndex", "Orden de capa", 0, 100], ["duration", "Duración (0 = manual)", 0, 3600]].map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} step={key === 'opacity' ? 0.05 : 1} value={config[key]} onChange={e => set(key, Number(e.target.value))} /></label>)}
          <label>Ajuste<select value={config.fit} onChange={e => set('fit', e.target.value)}><option value="contain">Completo</option><option value="cover">Cubrir</option><option value="fill">Estirar</option></select></label><label>Al terminar el video<select value={config.endBehavior} onChange={e => set('endBehavior', e.target.value)}><option value="hide">Ocultar todo</option><option value="hold">Conservar último cuadro y texto</option><option value="text">Conservar solo texto</option></select></label>
          <label><input type="checkbox" checked={config.loop} onChange={e => set('loop', e.target.checked)} />Repetir video</label><label><input type="checkbox" checked={config.muted} onChange={e => set('muted', e.target.checked)} />Silenciar audio</label>
        </div>
        <details><summary>Texto dinámico sobre el recurso</summary><div className="media-fields"><label>Nombre / título<input maxLength={100} value={config.title} onChange={e => set('title', e.target.value)} /></label><label>Cargo / subtítulo<input maxLength={180} value={config.subtitle} onChange={e => set('subtitle', e.target.value)} /></label>{[['textDelay', 'Entrada del texto (s)', 0, 60], ['textX', 'Texto X', 0, 3840], ['textY', 'Texto Y', 0, 2160], ['fontSize', 'Tamaño del texto', 12, 160]].map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} value={config[key]} onChange={e => set(key, Number(e.target.value))} /></label>)}</div></details>
        <p className="media-hint">Lienzo 1920 × 1080. Orden 0–9: debajo de los gráficos actuales; 11–100: encima. La vista previa siempre está silenciada.</p>
        <div className="media-actions"><button disabled={!assetId} onClick={() => control('take')}>Mostrar / PLAY en capa {Number(slot) + 1}</button><button className="outline" disabled={!assetId || assets.find(a => a._id === assetId)?.builtin} onClick={() => run(async () => { await api(`/media/${assetId}`, { method: 'DELETE' }); setAssets(list => list.filter(a => a._id !== assetId)); setAssetId(''); setMessage('Retirado de la biblioteca. Las capas emitidas conservan el archivo.'); })}>Quitar de biblioteca</button></div>
      </div>
      <div className="media-layer-list">{Object.entries(snapshot?.mediaLayers || {}).filter(([, layer]) => layer.config).map(([key, layer]) => <div key={key} className={active(layer) ? 'media-layer on-air' : 'media-layer'}><div><small>CAPA {Number(key) + 1} · {active(layer) ? layer.playing === false ? 'DETENIDO' : 'EN AIRE' : 'OCULTA'}</small><strong>{layer.name}</strong></div><div className="media-actions"><button className="outline" onClick={() => control('play', key)}>PLAY</button><button className="outline" onClick={() => control('stop', key)}>STOP</button><button className="outline" onClick={() => control('restart', key)}>RESTART</button><button className="outline" onClick={() => control('hide', key)}>HIDE</button></div></div>)}</div>
      <SponsorMedia sponsors={sponsors} assets={assets} api={api} onSaved={onSaved} run={run} control={control} />
    </fieldset>
    <div className="media-live-preview">{preview}</div>
  </details>;
}

function SponsorMedia({ sponsors, assets, api, onSaved, run, control }) {
  const [sponsorId, setSponsorId] = useState('');
  const [duration, setDuration] = useState(10);
  const sponsor = sponsors.find(s => s._id === sponsorId);
  return <section className="media-sponsors"><h3>Auspiciantes · emisión directa</h3><div className="media-fields"><label>Auspiciante<select value={sponsorId} onChange={e => setSponsorId(e.target.value)}><option value="">Selecciona un auspiciante</option>{sponsors.filter(s => s.active !== false).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label><label>Duración<select value={duration} onChange={e => setDuration(Number(e.target.value))}>{[5, 10, 15, 0].map(s => <option key={s} value={s}>{s ? `${s} s` : 'Manual'}</option>)}</select></label></div>
    {sponsor && <div className="media-fields">{[['mediaLogo', 'LOGO', 'image'], ['mediaMotion', 'ANIMACIÓN', 'webm'], ['mediaVideo', 'VIDEO', 'video']].map(([field, label, kind]) => <div key={field}><label>{label}<select value={sponsor[field] || ''} onChange={e => { const value = e.target.value; run(async () => { await api(`/sponsors/${sponsor._id}`, { method: 'PUT', body: JSON.stringify({ [field]: value || null }) }); await onSaved(); }); }}><option value="">Asignar desde biblioteca</option>{assets.filter(a => kind === 'webm' ? a.format === 'webm' : a.kind === kind).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}</select></label><button disabled={!sponsor[field] && !(field === 'mediaLogo' && sponsor.logo?.secureUrl)} onClick={() => control('take', '15', { sponsorId: sponsor._id, variant: field, config: { ...defaults, ...(kind === 'image' ? layouts.logo : layouts.full), duration, title: '', zIndex: 60 } })}>Mostrar {label}</button></div>)}</div>}
    <button className="outline" onClick={() => control('hide', '15')}>HIDE SPONSOR</button>
  </section>;
}
