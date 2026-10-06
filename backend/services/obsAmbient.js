export function audibleCommercial(deck, now = Date.now()) {
  const ads = deck?.ads;
  if (!ads?.startedAt || !Array.isArray(ads.items)) return false;
  let elapsed = (now - new Date(ads.startedAt).getTime()) / 1000;
  if (!Number.isFinite(elapsed) || elapsed < 0) return false;
  for (const item of ads.items) {
    const duration = Number(item.duration) || 0;
    if (elapsed < duration) return item.kind === 'video' && item.muted !== true;
    elapsed -= duration;
  }
  return false;
}

// The caller serializes operations. Muting is deliberately independent: an
// operator's mute must survive the end of a commercial and a reconnect.
export class AmbientControl {
  constructor(call, save, settings) { this.call = call; this.save = save; this.settings = settings; }
  async persist(changes) { await this.save(changes); Object.assign(this.settings, changes); }
  async volume() { return (await this.call('GetInputVolume', { inputName: this.settings.inputName })).inputVolumeMul; }
  async setVolume(volume) { await this.call('SetInputVolume', { inputName: this.settings.inputName, inputVolumeMul: volume }); }
  async reconcile(duck) {
    const s = this.settings;
    if (duck) {
      const current = await this.volume();
      if (s.restoreVolume == null) await this.persist({ restoreVolume: current, appliedVolume: Math.min(current, s.ambientPercent / 100) });
      // Respect a volume adjustment made directly in OBS while ducking.
      else if (s.appliedVolume != null && Math.abs(current - s.appliedVolume) > 0.0001) await this.persist({ restoreVolume: current, appliedVolume: Math.min(current, s.ambientPercent / 100) });
      const target = Math.min(s.restoreVolume, s.ambientPercent / 100);
      if (s.appliedVolume !== target) await this.persist({ appliedVolume: target });
      if (Math.abs(current - target) > 0.0001) await this.setVolume(target);
    } else if (s.restoreVolume != null) {
      const current = await this.volume();
      if (s.appliedVolume == null || Math.abs(current - s.appliedVolume) < 0.0001) await this.setVolume(s.restoreVolume);
      await this.persist({ restoreVolume: null, appliedVolume: null });
    }
  }
  async manualVolume(percent, duck) {
    const volume = percent / 100;
    if (duck) {
      const target = Math.min(volume, this.settings.ambientPercent / 100);
      await this.persist({ restoreVolume: volume, appliedVolume: target });
      await this.setVolume(target);
    } else {
      await this.setVolume(volume);
      await this.persist({ restoreVolume: null, appliedVolume: null });
    }
  }
}
