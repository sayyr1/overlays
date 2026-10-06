import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { OBSWebSocket } from 'obs-websocket-js';
import ObsAudio from '../models/ObsAudio.js';
import OverlayState from '../models/OverlayState.js';
import { AmbientControl, audibleCommercial } from './obsAmbient.js';
import { remoteObsAudio } from './remoteObsAudio.js';

const unavailable = message => Object.assign(new Error(message), { status: 503 });
const deadline = async (promise, ms = 2500) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(unavailable('OBS no respondió. Comprueba la conexión WebSocket.')), ms); })]); }
  finally { clearTimeout(timer); }
};

class ObsAudioService {
  constructor() {
    this.obs = new OBSWebSocket(); this.connected = false; this.error = ''; this.nextTry = 0;
    this.queue = Promise.resolve(); this.deck = {}; this.settings = null;
    this.obs.on('ConnectionClosed', () => { this.connected = false; });
    this.obs.on('ConnectionError', () => { this.connected = false; });
  }
  serial(fn) { const task = this.queue.then(fn); this.queue = task.catch(() => {}); return task; }
  async load() {
    if (this.settings) return;
    const settings = await ObsAudio.findOneAndUpdate({ computer: os.hostname() }, { $setOnInsert: { computer: os.hostname() } }, { upsert: true, new: true }).lean();
    this.settings = settings;
    this.control = new AmbientControl((name, args) => deadline(this.obs.call(name, args)), changes => ObsAudio.updateOne({ _id: settings._id }, { $set: changes }), settings);
    if (settings.tournament) this.deck = (await OverlayState.findOne({ tournament: settings.tournament }).lean())?.sponsorDeck || {};
    this.timer = setInterval(() => this.serial(async () => {
      if (!this.settings.duckEnabled && this.settings.restoreVolume == null) return;
      try { await this.connect(); await this.control.reconcile(this.ducking()); this.error = ''; }
      catch (error) { this.error = error.message; }
    }), 750);
    this.timer.unref();
  }
  ducking() { return Boolean(this.settings?.duckEnabled && audibleCommercial(this.deck)); }
  async connect(force = false) {
    if (process.env.VERCEL) throw unavailable('El control de OBS requiere el backend funcionando en tu computadora.');
    if (this.connected) return;
    if (!force && Date.now() < this.nextTry) throw unavailable(this.error || 'OBS desconectado.');
    this.nextTry = Date.now() + 5000;
    let local = {};
    if (process.env.APPDATA) {
      try { local = JSON.parse(await fs.readFile(path.join(process.env.APPDATA, 'obs-studio', 'plugin_config', 'obs-websocket', 'config.json'), 'utf8')); } catch { /* Environment configuration also supports other systems. */ }
    }
    const url = process.env.OBS_WEBSOCKET_URL || `ws://127.0.0.1:${local.server_port || 4455}`;
    const password = process.env.OBS_WEBSOCKET_PASSWORD ?? (local.auth_required ? local.server_password : undefined);
    if (!process.env.OBS_WEBSOCKET_URL && local.server_enabled === false) throw unavailable('Activa en OBS: Herramientas → Ajustes del servidor WebSocket → Activar servidor WebSocket.');
    try { await deadline(this.obs.connect(url, password, { rpcVersion: 1, eventSubscriptions: 0 })); this.connected = true; this.error = ''; }
    catch {
      await this.obs.disconnect().catch(() => {});
      this.error = 'No se pudo conectar con OBS. Revisa que esté abierto y el servidor WebSocket activado.';
      throw unavailable(this.error);
    }
  }
  async view() {
    const s = this.settings;
    const common = { connected: this.connected, inputName: s.inputName, tournamentId: s.tournament ? String(s.tournament) : null, duckEnabled: s.duckEnabled, ambientPercent: s.ambientPercent, ducking: this.ducking() && s.restoreVolume != null };
    if (!this.connected) return { ...common, message: this.error, inputs: [] };
    const list = await deadline(this.obs.call('GetInputList'));
    const inputs = list.inputs.map(input => input.inputName);
    try {
      const [volume, mute] = await Promise.all([
        deadline(this.obs.call('GetInputVolume', { inputName: s.inputName })),
        deadline(this.obs.call('GetInputMute', { inputName: s.inputName })),
      ]);
      return { ...common, sourceAvailable: true, volumePercent: Math.round((s.restoreVolume ?? volume.inputVolumeMul) * 100), outputPercent: Math.round(volume.inputVolumeMul * 100), muted: mute.inputMuted, inputs };
    } catch { return { ...common, sourceAvailable: false, inputs, message: `Selecciona la fuente de audio BELABOX. No se encontró ${s.inputName}.` }; }
  }
  status(force = false) { return this.serial(async () => {
    await this.load();
    try { await this.connect(force); if (this.ducking() || this.settings.restoreVolume != null) await this.control.reconcile(this.ducking()); return await this.view(); }
    catch (error) { this.error = error.status === 503 ? error.message : `No se pudo leer la fuente ${this.settings.inputName}. Comprueba su nombre en OBS.`; return { connected: false, inputName: this.settings.inputName, tournamentId: this.settings.tournament ? String(this.settings.tournament) : null, duckEnabled: this.settings.duckEnabled, ambientPercent: this.settings.ambientPercent, message: this.error, inputs: [] }; }
  }); }
  update(input) { return this.serial(async () => {
    await this.load(); await this.connect(true);
    // Switching the source/event restores the previous source before rebinding.
    if ((input.inputName !== undefined && input.inputName !== this.settings.inputName) || (input.tournament !== undefined && String(input.tournament) !== String(this.settings.tournament))) await this.control.reconcile(false);
    if (input.inputName !== undefined) {
      await deadline(this.obs.call('GetInputVolume', { inputName: input.inputName }));
      await deadline(this.obs.call('GetInputMute', { inputName: input.inputName }));
    }
    const changes = Object.fromEntries(['inputName', 'tournament', 'duckEnabled', 'ambientPercent'].filter(key => input[key] !== undefined).map(key => [key, input[key]]));
    if (Object.keys(changes).length) await this.control.persist(changes);
    if (input.tournament !== undefined) this.deck = (await OverlayState.findOne({ tournament: input.tournament }).lean())?.sponsorDeck || {};
    if (input.muted !== undefined) await deadline(this.obs.call('SetInputMute', { inputName: this.settings.inputName, inputMuted: input.muted }));
    if (input.volumePercent !== undefined) await this.control.manualVolume(input.volumePercent, this.ducking());
    await this.control.reconcile(this.ducking());
    this.error = ''; return this.view();
  }); }
  notify(state) {
    if (!this.settings || String(state.tournament) !== String(this.settings.tournament)) return Promise.resolve();
    return this.serial(async () => {
      this.deck = state.sponsorDeck || {};
      if (!this.settings.duckEnabled && this.settings.restoreVolume == null) return;
      try { await this.connect(); await this.control.reconcile(this.ducking()); this.error = ''; }
      catch (error) { this.error = error.message; }
    });
  }
}
const localObsAudio = new ObsAudioService();
const remote = () => Boolean(process.env.VERCEL || process.env.OBS_CONTROL_MODE === 'bridge');
export const obsAudio = {
  load: () => remote() ? Promise.resolve() : localObsAudio.load(),
  status: force => remote() ? remoteObsAudio.status() : localObsAudio.status(force),
  update: input => remote() ? remoteObsAudio.update(input) : localObsAudio.update(input),
  notify: state => remote() ? Promise.resolve() : localObsAudio.notify(state),
};
