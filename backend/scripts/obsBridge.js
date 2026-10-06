import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { OBSWebSocket } from 'obs-websocket-js';
import { ObsBridgeRuntime } from '../services/obsBridgeRuntime.js';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configArg = process.argv.indexOf('--config');
const configPath = configArg >= 0 ? path.resolve(process.argv[configArg + 1] || '') : path.join(backend, '.obs-bridge.json');
const statePath = path.join(backend, '.obs-bridge-state.json');
const lockPath = path.join(backend, '.obs-bridge.lock');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = async promise => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('OBS no respondió.')), 2500); })]); }
  finally { clearTimeout(timer); }
};
async function main() {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const url = new URL(config.serverUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('La URL del puente debe usar HTTPS.');
  if (!/^[\w-]{43}$/.test(String(config.token))) throw new Error('Archivo de vinculación no válido. Descárgalo desde la app.');
  const acquire = () => fsSync.writeFileSync(lockPath, JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 });
  try { acquire(); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const prior = JSON.parse(fsSync.readFileSync(lockPath, 'utf8'));
    let running = true;
    try { process.kill(prior.pid, 0); } catch (check) { if (check.code === 'ESRCH') running = false; }
    if (running) throw new Error('El puente ya está funcionando en esta computadora.');
    fsSync.unlinkSync(lockPath); acquire();
  }
  process.on('exit', () => { try { fsSync.unlinkSync(lockPath); } catch { /* Already removed. */ } });
  let persisted = {};
  try { persisted = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch { /* First launch. */ }
  const agentId = persisted.agentId || crypto.randomUUID();
  const save = async next => {
    const temp = `${statePath}.tmp`;
    await fs.writeFile(temp, JSON.stringify({ ...next, agentId }), { mode: 0o600 });
    await fs.rename(temp, statePath);
  };
  const obs = new OBSWebSocket();
  let connected = false, nextTry = 0, stopping = false, message = '', lastLog = '';
  let queue = Promise.resolve();
  const serial = fn => { const task = queue.then(fn); queue = task.catch(() => {}); return task; };
  const log = text => { if (lastLog !== text) { console.log(`${new Date().toISOString()} ${text}`); lastLog = text; } };
  obs.on('ConnectionClosed', () => { connected = false; });
  obs.on('ConnectionError', () => { connected = false; });
  const connect = async () => {
    if (connected) return;
    if (Date.now() < nextTry) throw new Error(message || 'OBS desconectado.');
    nextTry = Date.now() + 5000;
    let local = {};
    if (process.env.APPDATA) {
      try { local = JSON.parse(await fs.readFile(path.join(process.env.APPDATA, 'obs-studio', 'plugin_config', 'obs-websocket', 'config.json'), 'utf8')); } catch { /* Other systems use environment variables. */ }
    }
    if (!process.env.OBS_WEBSOCKET_URL && local.server_enabled === false) throw new Error('Activa el servidor WebSocket en OBS → Herramientas.');
    try {
      await deadline(obs.connect(process.env.OBS_WEBSOCKET_URL || `ws://127.0.0.1:${local.server_port || 4455}`, process.env.OBS_WEBSOCKET_PASSWORD ?? (local.auth_required ? local.server_password : undefined), { rpcVersion: 1, eventSubscriptions: 0 }));
      connected = true;
    } catch { await obs.disconnect().catch(() => {}); throw new Error('OBS desconectado. Revisa el servidor WebSocket local.'); }
  };
  const runtime = new ObsBridgeRuntime((name, args) => deadline(obs.call(name, args)), save, persisted);
  // A previous pairing may have been replaced; restore first instead of applying
  // a cached advertisement from that pairing to a different production.
  const pairing = crypto.createHash('sha256').update(config.token).digest('hex');
  if (persisted.pairing && persisted.pairing !== pairing) await runtime.persist({ deck: {}, duckEnabled: false, completed: [] });
  await runtime.persist({ pairing });
  const report = async () => {
    try {
      await connect();
      const { inputs } = await deadline(obs.call('GetInputList'));
      try {
        const [volume, mute] = await Promise.all([deadline(obs.call('GetInputVolume', { inputName: runtime.state.inputName })), deadline(obs.call('GetInputMute', { inputName: runtime.state.inputName }))]);
        return { connected: true, sourceAvailable: true, inputName: runtime.state.inputName, inputs: inputs.map(input => input.inputName), muted: mute.inputMuted, volumePercent: Math.round((runtime.state.restoreVolume ?? volume.inputVolumeMul) * 100), outputPercent: Math.round(volume.inputVolumeMul * 100), ducking: runtime.ducking() && runtime.state.restoreVolume != null, message };
      } catch { return { connected: true, sourceAvailable: false, inputName: runtime.state.inputName, inputs: inputs.map(input => input.inputName), message: `No se encontró la fuente ${runtime.state.inputName}. Selecciónala desde la app.` }; }
    } catch (error) { return { connected: false, inputName: runtime.state.inputName, message: error.message }; }
  };
  const timer = setInterval(() => serial(async () => {
    try { await connect(); await runtime.reconcile(); }
    catch (error) { message = error.message; }
  }), 500);
  const shutdown = async () => {
    if (stopping) return;
    stopping = true; clearInterval(timer);
    try { await serial(async () => { await connect(); await runtime.restore(); }); }
    catch { log('No se pudo restaurar ahora. El nivel anterior quedó guardado para el siguiente inicio.'); }
    await obs.disconnect().catch(() => {});
  };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  log('Puente iniciado. Conectando con la web y OBS de casa.');
  while (!stopping) {
    try {
      const status = await serial(report);
      const sentAt = Date.now();
      const response = await fetch(new URL('/api/sports/obs/bridge/poll', url.origin), {
        method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, status, acknowledged: runtime.state.completed.slice(-50) }),
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      if (stopping) break;
      if (!response.ok) {
        if ([401, 409].includes(response.status)) await serial(async () => { await runtime.persist({ deck: {}, duckEnabled: false }); if (connected) await runtime.reconcile(); });
        throw new Error(response.status === 401 ? 'Vinculación reemplazada. Descarga un archivo nuevo y reinicia el puente.' : response.status === 409 ? 'Otro puente está conectado. Cierra la copia adicional.' : `La web no está disponible (HTTP ${response.status}).`);
      }
      const payload = await response.json();
      const offset = new Date(payload.serverTime).getTime() - (sentAt + Date.now()) / 2;
      await serial(() => runtime.receive(payload, offset));
      message = '';
      log(status.connected ? 'Web conectada · OBS conectado.' : `Web conectada · ${status.message}`);
    } catch (error) {
      // Network failures do not stop the local timeline or volume restoration.
      log(error.name === 'TimeoutError' || error.name === 'TypeError' ? 'Sin conexión con la web. La restauración local sigue activa.' : error.message);
    }
    if (!stopping) await wait(1500);
  }
}
main().catch(error => { console.error(error.code === 'ENOENT' ? 'Falta el archivo de vinculación. Usa --config con el JSON descargado desde la app.' : error.message); process.exitCode = 1; });
