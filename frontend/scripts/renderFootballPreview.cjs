// Generates a public, offline gallery from the actual components and CSS.
// Fictional data only: never connects to an event, API, OBS or WebSocket.
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const original = require.extensions['.js'];
require.extensions['.css'] = () => {};
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(path.join(root, 'src'))) return original(module, filename);
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    presets: [require.resolve('@babel/preset-react')], plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  module._compile(result.code, filename);
};
const Overlay = require('../src/components/overlay/OverlayComposition').default;
const { previewSnapshot } = require('../src/components/overlay/previewFixture');
const { teamCrest } = require('../src/components/overlay/TeamBadge');
const base = { ...previewSnapshot, tournament: { ...previewSnapshot.tournament, logo: { secureUrl: teamCrest({ code: 'CDS', primaryColor: '#173c58', secondaryColor: '#e9c46a' }) } } };
const scenes = [
  ['Partido en juego', base.graphics],
  ['Presentación del partido', { main: { type: 'presentacion' } }],
  ['Medio tiempo', { main: { type: 'descanso' } }],
  ['Resultado final', { main: { type: 'resultado_final' } }],
  ['Estadísticas', { main: { type: 'estadisticas' } }],
  ['Alineación local', { main: { type: 'alineacion_local' } }],
  ['Gol e identificación', { ...base.graphics, temporary: { type: 'gol', data: { side: 'home', playerName: 'A. Valencia' } }, lowerThird: { type: 'narradores', data: { name: 'Equipo de transmisión' } } }],
  ['Tarjeta amarilla', { ...base.graphics, temporary: { type: 'yellow_card', data: { team: 'away', playerName: 'R. Molina' } } }],
  ['Revisión VAR', { ...base.graphics, temporary: { type: 'var', data: { message: 'Posible penal' } } }],
];
const css = ['broadcast.css', 'sponsor-deck.css', 'football-package.css'].map(file => fs.readFileSync(path.join(root, 'src/components/overlay', file), 'utf8')).join('\n');
const panels = scenes.map(([title, graphics], index) => `<article id="scene-${index}"><h2>${String(index + 1).padStart(2, '0')} / ${title}</h2><div class="review-stage"><div class="review-canvas">${renderToStaticMarkup(React.createElement(Overlay, { preview: true, snapshot: { ...base, graphics } }))}</div></div></article>`).join('');
const options = scenes.map(([name], i) => `<option value="scene-${i}">${name}</option>`).join('');
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Overlays de fútbol · Imbabura en Vivo</title><style>${css}
html{scroll-behavior:smooth;scroll-padding-top:100px}body{margin:0;background:#0a1521;color:#edf3fa;font-family:Segoe UI,Arial,sans-serif}main{max-width:1280px;margin:auto;padding:24px 16px 64px}.review-intro h1{font-size:28px;margin:0 0 12px}.review-intro p{color:#aebfd0;line-height:1.6}.review-toolbar{display:flex;gap:12px;align-items:center;padding:12px 16px;position:sticky;top:0;background:#0a1521f5;z-index:30;border-bottom:1px solid #294153}.review-toolbar label{display:flex;align-items:center;gap:10px;font-size:13px}.review-toolbar select,.review-toolbar button{min-height:44px;background:#173149;color:#edf3fa;border:1px solid #496277;border-radius:8px;padding:8px 12px;font:inherit}article{margin-top:30px}article>h2{font-size:15px;font-weight:600;letter-spacing:.08em;margin:0 0 12px}.review-stage{position:relative;aspect-ratio:16/9;overflow:hidden;border:1px solid #354b5a;background:repeating-linear-gradient(90deg,#29463a 0 10%,#305040 10% 20%)}.review-stage:before{content:'';position:absolute;inset:10% 8%;border:1px solid #ffffff35}.review-stage:after{content:'';position:absolute;top:10%;bottom:10%;left:50%;border-left:1px solid #ffffff35}.review-canvas{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:top left;z-index:1}.neutral .review-stage{background:repeating-conic-gradient(#293642 0 25%,#202a34 0 50%) 0/28px 28px}.review-footer{color:#9bb0c2;font-size:13px;line-height:1.6;margin-top:32px}.review-footer a{color:#e9c46a}@media(max-width:600px){.review-toolbar{flex-wrap:wrap}.review-toolbar label{flex:1}.review-toolbar select{min-width:0;width:100%}.review-intro h1{font-size:23px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body><nav class="review-toolbar" aria-label="Revisar diseños"><label>Ver <select id="scene-picker">${options}</select></label><button id="background" type="button">Cambiar fondo</button></nav><main><header class="review-intro"><h1>Paquete de fútbol · Imbabura en Vivo</h1><p>Diseños reales de la app, con datos y escudos ficticios. El fondo de cancha sirve para revisar contraste; no forma parte del overlay que recibe OBS.</p></header>${panels}<p class="review-footer">Referencias de investigación: <a href="https://designmuseum.org/exhibitions/beazley-designs-of-the-year/digital-20x/premier-league-on-air-branding">Premier League / DixonBaxi</a> y <a href="https://www.uefa.com/news-media/news/0290-1badd36e73b2-c3e5755b7fae-1000--uefa-unveils-new-uefa-champions-league-brand-identity/">UEFA Champions League</a>. Diseño original adaptado a los colores del evento. Esta galería no controla la transmisión.</p></main><script>const resize=new ResizeObserver(entries=>entries.forEach(entry=>entry.target.firstElementChild.style.transform='scale('+entry.contentRect.width/1920+')'));document.querySelectorAll('.review-stage').forEach(stage=>resize.observe(stage));document.getElementById('scene-picker').addEventListener('change',event=>document.getElementById(event.target.value).scrollIntoView());document.getElementById('background').addEventListener('click',()=>document.body.classList.toggle('neutral'));</script></body></html>`;
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'public/football-preview.html'), html);
console.log('Generated football-preview.html from current React templates.');
