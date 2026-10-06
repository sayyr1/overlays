// Offline review with fictional data; never changes the broadcast state.
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
const { previewSnapshot: base } = require('../src/components/overlay/previewFixture');
const scenes = [
  ['Marcador y gol', { temporary: { id: 'goal', type: 'gol', data: { playerName: 'A. Valencia', teamName: 'Deportivo del Norte' } } }],
  ['Presentación', { main: { id: 'opening', type: 'presentacion' } }],
  ['Resultado final', { main: { id: 'result', type: 'resultado_final' } }],
  ['Estadísticas', { main: { id: 'stats', type: 'estadisticas' } }],
  ['Alineación', { main: { id: 'lineup', type: 'alineacion_local' } }],
  ['Identificación', { lowerThird: { id: 'name', type: 'narradores', data: { name: 'Equipo de transmisión' } } }],
];
const css = ['broadcast.css', 'sponsor-deck.css'].map(file => fs.readFileSync(path.join(root, 'src/components/overlay', file), 'utf8').replace(/^\uFEFF/, '')).join('\n');
const panels = scenes.map(([title, graphics]) => `<section><h2>${title}</h2><div class="stage"><div class="canvas">${renderToStaticMarkup(React.createElement(Overlay, { preview: true, snapshot: { ...base, graphics: { ...base.graphics, ...graphics } } }))}</div></div></section>`).join('');
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisión de overlays</title><style>${css}
body { margin:0; padding:32px; background:#090f18; color:#edf3fa; font-family:Segoe UI,Arial,sans-serif; }
h1 {font-size:26px;margin:0 0 8px} body>p{color:#9bafc3;margin:0 0 32px} h2 {font-size:16px;margin:0 0 12px} section{margin-bottom:28px}
.stage{width:960px;height:540px;overflow:hidden;border:1px solid #ffffff20;background:repeating-linear-gradient(90deg,#293e36 0 120px,#2e463c 120px 240px);position:relative}
.stage:before{content:'';position:absolute;inset:42px 60px;border:1px solid #ffffff25} .stage:after{content:'';position:absolute;left:50%;top:42px;bottom:42px;border-left:1px solid #ffffff25}
.canvas{width:1920px;height:1080px;transform:scale(.5);transform-origin:top left;position:relative;z-index:1}
</style><h1>Paquete gráfico · Copa de la Sierra</h1><p>Revisión visual con datos ficticios · lienzo 1920 × 1080 · fondo de referencia</p>${panels}</html>`;
const output = path.resolve(root, '../artifacts/overlay-design-review.html');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log(output);
