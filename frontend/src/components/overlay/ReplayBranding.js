import React, { useEffect, useState } from 'react';
import './replay.css';

export default function ReplayBranding({ tournament, api }) {
  const [assets, setAssets] = useState([]);
  const [asset, setAsset] = useState(null);
  const [placement, setPlacement] = useState('corner');
  const [showLabel, setShowLabel] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    Promise.all([api(`/tournaments/${tournament._id}/replay-branding`), api('/media')]).then(([settings, library]) => {
      if (!current) return;
      setAsset(settings.asset); setPlacement(settings.placement || 'corner'); setShowLabel(settings.showLabel !== false);
      setAssets(library.filter(a => ['png', 'webp', 'jpg', 'jpeg', 'mp4', 'webm'].includes(a.format)));
      setLoading(false);
    }).catch(e => { if (current) { setError(e.message); setLoading(false); } });
    return () => { current = false; };
  }, [api, tournament._id]);
  const choose = next => {
    setAsset(next); setDirty(true); setMessage('');
    setPlacement(next?.format === 'mp4' ? 'intro' : next?.kind === 'video' ? 'overlay' : 'corner');
    setShowLabel(next?.kind !== 'video');
  };
  const run = async fn => { setBusy(true); setError(''); setMessage(''); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const upload = event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    run(async () => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['png', 'webp', 'jpg', 'jpeg', 'webm', 'mp4'].includes(ext)) throw new Error('Usa PNG, WebP, JPG, WebM o MP4.');
      const kind = ['webm', 'mp4'].includes(ext) ? 'video' : 'image';
      if (file.size > (kind === 'video' ? 100 : 10) * 1024 * 1024) throw new Error('Máximo: logo 10 MB; animación 100 MB.');
      const signed = await api('/media/sign', { method: 'POST', body: JSON.stringify({ kind }) });
      const body = new FormData();
      Object.entries(signed.params).forEach(([key, value]) => body.append(key, String(value)));
      body.append('api_key', signed.apiKey); body.append('signature', signed.signature); body.append('file', file);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/${kind}/upload`, { method: 'POST', body });
      const uploaded = await response.json();
      if (!response.ok) throw new Error(uploaded.error?.message || 'No se pudo subir el archivo.');
      const next = await api('/media', { method: 'POST', body: JSON.stringify({ publicId: uploaded.public_id, kind, category: kind === 'video' ? 'videos' : 'logos', name: file.name.slice(0, 90) }) });
      setAssets(list => [next, ...list.filter(a => a._id !== next._id)]); choose(next);
      setMessage('Archivo subido. Guarda la configuración para usarlo en las repeticiones.');
    });
  };
  const invalidIntro = asset && placement === 'intro' && (asset.kind !== 'video' || !(asset.duration > 0 && asset.duration <= 10));
  const save = () => run(async () => {
    await api(`/tournaments/${tournament._id}/replay-branding`, { method: 'PUT', body: JSON.stringify({ assetId: asset?.id || asset?._id || null, placement, showLabel }) });
    setDirty(false); setMessage('Guardado. Se aplicará automáticamente en la próxima repetición.');
  });
  return <section className="replay-branding">
    <header><span className="eyebrow">IDENTIDAD DE REPETICIONES</span><h2>Tu logo, tu animación</h2><p>Prepara el gráfico una vez. OBS lo mostrará al reproducir una jugada desde la web.</p></header>
    {error && <p role="alert" className="brand-error">{error}</p>}
    {message && <p role="status" className="replay-help">{message}</p>}
    <fieldset disabled={loading || busy}>
      <div className="replay-branding-layout"><div className="replay-branding-controls">
        <label className="replay-upload">{busy ? 'Procesando archivo…' : 'Subir logo o animación'}<input aria-label="Subir logo o animación" type="file" accept=".png,.webp,.jpg,.jpeg,.mp4,.webm" onChange={upload} /></label>
        <small>Logo hasta 10 MB · Animación hasta 100 MB.</small>
        <label>O reutilizar de la biblioteca<select value={asset?.id || asset?._id || ''} onChange={e => choose(assets.find(a => a._id === e.target.value) || null)}><option value="">Solo rótulo de OBS</option>{asset?.id && !assets.some(a => a._id === asset.id) && <option value={asset.id}>{asset.name} · archivo del evento</option>}{assets.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}</select></label>
        {asset && <><label>Cómo mostrarlo<select value={placement} onChange={e => { setPlacement(e.target.value); setDirty(true); }}><option value="corner">Logo en la esquina superior derecha</option>{asset.kind === 'video' && <option value="intro">Entrada antes de la jugada</option>}<option value="overlay">Gráfico sobre toda la repetición</option></select></label>
        <p className="replay-help">{placement === 'intro' ? 'La animación se reproduce una vez y después comienza la jugada. Usa un video de hasta 10 segundos.' : placement === 'overlay' ? 'Diseña en 1920 × 1080. Usa WebM con transparencia para dejar visible la jugada. La animación se repite durante el clip.' : 'Logo destacado de hasta 520 × 300, centrado sobre una placa oscura y sin deformarlo. El rótulo amarillo identifica claramente la repetición.'}</p></>}
        <label className="replay-checkbox"><input type="checkbox" checked={showLabel} onChange={e => { setShowLabel(e.target.checked); setDirty(true); }} />Añadir rótulo “REPETICIÓN” de OBS</label>
        <small>Si tu animación ya incluye “REPETICIÓN”, deja esta opción desactivada. Los gráficos se emiten sin audio.</small>
        {invalidIntro && <p role="alert" className="brand-error">La entrada debe ser un video de hasta 10 segundos.</p>}
        <div className="replay-branding-buttons"><button disabled={!dirty || Boolean(invalidIntro)} onClick={save}>{busy ? 'Guardando…' : 'Guardar configuración'}</button>{asset && <button className="outline" onClick={() => choose(null)}>Quitar gráfico</button>}</div>
      </div><div><div className={`replay-branding-preview placement-${placement} ${asset ? 'has-replay-asset' : ''} ${showLabel ? 'has-replay-label' : ''}`} aria-label="Vista previa del gráfico de repetición">
        <span className="replay-preview-caption">{placement === 'intro' && asset ? 'ENTRADA' : 'VISTA PREVIA · JUGADA'}</span>
        {asset && placement === 'corner' && <div className="replay-preview-plate" />}
        {asset && (asset.kind === 'video' ? <video key={asset.secureUrl} src={asset.secureUrl} muted loop autoPlay playsInline controls={placement === 'intro'} /> : <img src={asset.secureUrl} alt={asset.name || 'Logo de repetición'} />)}
        {showLabel && <strong>REPETICIÓN</strong>}
      </div><p className="replay-help">{loading ? 'Cargando configuración…' : dirty ? 'Cambios pendientes de guardar.' : 'Configuración guardada para este evento.'} Los clips permanecen en la computadora de OBS.</p></div></div>
    </fieldset>
  </section>;
}
