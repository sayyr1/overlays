// Produce a self-contained review from the actual React composition; no backend needed.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { createRequire } = Module;
const root = path.resolve(__dirname, '..');
const frontendRequire = createRequire(path.join(root, 'frontend/package.json'));
const React = frontendRequire('react');
const { renderToStaticMarkup } = frontendRequire('react-dom/server');
const babel = frontendRequire('@babel/core');
const load = relative => {
  const filename = path.join(root, relative);
  const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false,
    presets: [frontendRequire.resolve('@babel/preset-react')],
    plugins: [frontendRequire.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled.require = name => name.endsWith('.css') ? {} : frontendRequire(name);
  compiled._compile(code, filename);
  return compiled.exports;
};
const Overlay = load('frontend/src/components/overlay/OverlayComposition.js').default;
const { previewSnapshot: base } = load('frontend/src/components/overlay/previewFixture.js');
const scenes = [
  ['01 / Partido en juego', base.graphics],
  ['02 / Presentación', { main: { id: 'opening', type: 'presentacion' } }],
  ['03 / Resultado final', { main: { id: 'final', type: 'resultado_final' } }],
  ['04 / Estadísticas', { main: { id: 'stats', type: 'estadisticas' } }],
  ['05 / Alineación', { main: { id: 'lineup', type: 'alineacion_local' } }],
  ['06 / Gol, narración y auspiciante', { ...base.graphics, sponsorBugVisible: true, temporary: { id: 'goal', type: 'gol', data: { playerName: 'A. Valencia' } }, lowerThird: { id: 'lower', type: 'narradores', data: { name: 'Equipo de transmisión' } } }],
  ['07 / Tarjeta', { ...base.graphics, temporary: { id: 'card', type: 'yellow_card', data: { playerName: 'R. Molina' } } }],
  ['08 / Presentación sin partido', { main: { id: 'talk', type: 'broadcast_opening', data: { title: 'Ideas que conectan', subtitle: 'Conversaciones, historias y proyectos de nuestra comunidad' } } }, 'presentation'],
  ['09 / IRL: lugar y aviso', { lowerThird: { id: 'place', type: 'broadcast_location', data: { title: 'Recorriendo el centro histórico', subtitle: 'En directo desde Ibarra' } }, temporary: { id: 'notice', type: 'broadcast_announcement', data: { title: 'Volvemos en un momento', subtitle: 'Estamos recuperando la conexión' } } }, 'irl'],
  ['10 / Cuenta regresiva', { main: { id: 'countdown', type: 'broadcast_countdown', activatedAt: new Date().toISOString(), data: { title: 'En unos momentos comenzamos', subtitle: 'Gracias por acompañarnos', seconds: 300 } } }, 'general'],
];
const css = fs.readFileSync(path.join(root, 'frontend/src/components/overlay/broadcast.css'), 'utf8');
const cards = scenes.map(([title, graphics, mode = 'sports']) => `<article><h2>${title}</h2><div class="frame"><div class="canvas">${renderToStaticMarkup(React.createElement(Overlay, { preview: true, snapshot: { ...base, mode, match: mode === 'sports' ? base.match : null, graphics } }))}</div></div></article>`).join('');
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Imbabura en Vivo · Paquete de emisión</title><style>${css}
body{margin:0;padding:32px;background:#080f18;color:#e9eef4;font-family:Segoe UI,Arial,sans-serif}main{max-width:1400px;margin:auto}h1{font-size:30px;font-weight:600}p{color:#acbbca;line-height:1.6}h2{font-size:15px;font-weight:500;letter-spacing:.08em;margin:28px 0 12px}.frame{position:relative;aspect-ratio:16/9;overflow:hidden;background:repeating-linear-gradient(90deg,#25443a 0 10%,#294a3f 10% 20%);border:1px solid #344550}.canvas{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:top left}button{padding:10px 18px;color:#e9eef4;background:#243447;border:1px solid #526579;border-radius:5px;cursor:pointer}.neutral .frame{background:repeating-conic-gradient(#25313c 0 25%,#1b2631 0 50%) 0/32px 32px}</style><main><h1>Imbabura en Vivo</h1><p>Paquete de emisión · Composiciones reales a 1920 × 1080.<br>Datos y escudos ficticios. El fondo de prueba no forma parte de la salida de OBS.</p><button onclick="document.body.classList.toggle('neutral')">Cambiar fondo de prueba</button>${cards}</main><script>const observer=new ResizeObserver(entries=>entries.forEach(e=>e.target.firstElementChild.style.transform='scale('+e.contentRect.width/1920+')'));document.querySelectorAll('.frame').forEach(el=>observer.observe(el));</script></html>`;
const target = path.join(root, 'docs/overlay-preview.html');
fs.writeFileSync(target, html);
console.log(target);
