import React, { useEffect, useRef, useState } from 'react';

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
export function validateEventLogo(file) {
  if (!imageTypes.has(file.type)) throw new Error('Usa un logo PNG, JPG, WebP o SVG.');
  if (file.size > 5 * 1024 * 1024) throw new Error('El logo puede pesar hasta 5 MB.');
}
export async function uploadEventLogo(file, apiBase) {
  if (!file?.size) return null;
  validateEventLogo(file);
  const body = new FormData(); body.append('file', file); body.append('folder', 'eventos');
  const response = await fetch(`${apiBase}/api/sports/upload`, { method: 'POST', credentials: 'include', body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'No se pudo subir el logo. Intenta nuevamente.');
  return data;
}
export default function EventLogoField() {
  const [preview, setPreview] = useState(''), [error, setError] = useState('');
  const input = useRef(null), reader = useRef(null);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => { reader.current?.abort(); setPreview(''); setError(''); };
    form?.addEventListener('reset', reset);
    return () => { reader.current?.abort(); form?.removeEventListener('reset', reset); };
  }, []);
  const change = event => {
    reader.current?.abort(); setPreview(''); setError('');
    const file = event.target.files?.[0]; if (!file) return;
    try {
      validateEventLogo(file);
      const next = new FileReader(); reader.current = next;
      next.onload = () => setPreview(String(next.result)); next.readAsDataURL(file);
    } catch (e) { setError(e.message); event.target.value = ''; }
  };
  return <section className="event-logo-field"><label className="brand-upload">Logo del evento (opcional)<input ref={input} aria-label="Logo del evento (opcional)" type="file" name="eventLogo" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={change} /><small>PNG, JPG, WebP o SVG · Hasta 5 MB. Recomendamos PNG o WebP con fondo transparente.</small></label>{error && <p role="alert" className="brand-error">{error}</p>}{preview && <div className="event-logo-preview"><img src={preview} alt="Vista previa del logo del evento" /><button className="outline" type="button" onClick={() => { reader.current?.abort(); input.current.value = ''; setPreview(''); setError(''); }}>Quitar logo</button></div>}<p>Se guarda con el evento y se utiliza automáticamente en sus overlays. Puedes cambiarlo después en Marca y tema.</p></section>;
}
