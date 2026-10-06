import { AmbientControl, audibleCommercial } from './obsAmbient.js';

// No database or network dependency: the advertisement timeline and recovery
// baseline live on the OBS computer, independently of the phone and Vercel.
export class ObsBridgeRuntime {
  constructor(call, save, state = {}) {
    this.call = call; this.save = save;
    this.state = { inputName: 'BELABOX_SRT', tournamentId: null, duckEnabled: false, ambientPercent: 15, restoreVolume: null, appliedVolume: null, deck: {}, clockOffset: 0, completed: [], ...state };
    this.control = new AmbientControl(call, async changes => {
      const next = { ...this.state, ...changes };
      await save(next); Object.assign(this.state, changes);
    }, this.state);
  }
  now() { return Date.now() + this.state.clockOffset; }
  ducking() { return this.state.duckEnabled && audibleCommercial(this.state.deck, this.now()); }
  async persist(changes) { await this.control.persist(changes); }
  async reconcile() { await this.control.reconcile(this.ducking()); }
  async receive(payload, clockOffset) {
    const settings = payload.settings;
    if (settings.inputName !== this.state.inputName || settings.tournamentId !== this.state.tournamentId) await this.control.reconcile(false);
    if (settings.inputName !== this.state.inputName) {
      await this.call('GetInputVolume', { inputName: settings.inputName });
      await this.call('GetInputMute', { inputName: settings.inputName });
    }
    await this.persist({ inputName: settings.inputName, tournamentId: settings.tournamentId, duckEnabled: settings.duckEnabled, ambientPercent: settings.ambientPercent, deck: payload.deck || {}, clockOffset });
    for (const command of payload.commands || []) {
      if (this.state.completed.includes(command.id)) continue;
      if (new Date(command.expiresAt).getTime() > this.now()) {
        // Commands are bound to the source selected when the operator sent them.
        if (command.muted !== undefined) await this.call('SetInputMute', { inputName: command.inputName, inputMuted: command.muted });
        if (command.volumePercent !== undefined) {
          if (command.inputName === this.state.inputName) await this.control.manualVolume(command.volumePercent, this.ducking());
          else await this.call('SetInputVolume', { inputName: command.inputName, inputVolumeMul: command.volumePercent / 100 });
        }
      }
      await this.persist({ completed: [...this.state.completed, command.id].slice(-100) });
    }
    await this.reconcile();
  }
  async restore() { await this.persist({ deck: {}, duckEnabled: false }); await this.control.reconcile(false); }
}
