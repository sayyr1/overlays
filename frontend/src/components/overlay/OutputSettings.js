import React, { useEffect, useState } from 'react';
import './live-console.css';

export default function OutputSettings({ api }) {
  const [output, setOutput] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let current = true; api('/obs/output').then(data => { if (current) setOutput(data); }).catch(e => { if (current) setError(e.message); }); return () => { current = false; }; }, [api]);
  const url = output?.overlayUrl ? `${window.location.origin}${output.overlayUrl}` : '';
  const copy = async () => { try { await navigator.clipboard.writeText(url); setMessage('Enlace fijo copiado. Copiarlo no cambia la dirección.'); } catch { setMessage('Selecciona y copia el enlace que aparece abajo.'); } };
  const rotate = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { setOutput(await api('/obs/output/rotate', { method: 'POST', body: JSON.stringify({ confirmation }) })); setConfirmation(''); setMessage('Enlace reemplazado. Actualiza la fuente de navegador en OBS con la nueva dirección.'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section className="output-settings"><span className="eyebrow">CONEXIÓN CON OBS</span><h2>Un enlace para todos tus eventos</h2><p>Configura esta dirección una sola vez en tu fuente de navegador de OBS, con tamaño 1920 × 1080. Después cambia de evento desde “Enviar este evento a OBS”, sin editar la fuente.</p>
    {error && <p className="brand-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <label>Enlace permanente de OBS<input aria-label="Enlace permanente de OBS" readOnly value={url} onFocus={event => event.target.select()} /></label><button disabled={!url || busy} onClick={copy}>Copiar enlace fijo</button><p>Evento asignado: <strong>{output?.tournament?.name || 'Ninguno'}</strong>. Abrir otro evento en la aplicación no cambia lo que OBS recibe.</p>
    <details><summary>Ajustes avanzados · reemplazar enlace</summary><p>El enlace anterior dejará de funcionar. Esta opción solo es necesaria si quieres revocar una dirección compartida.</p><form onSubmit={rotate}><label>Escribe REEMPLAZAR ENLACE OBS<input value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><button className="output-rotate" disabled={busy || confirmation !== 'REEMPLAZAR ENLACE OBS'}>Reemplazar enlace de OBS</button></form></details>
  </section>;
}
