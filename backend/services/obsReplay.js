import crypto from 'node:crypto';
import fs from 'node:fs/promises';

export class ReplayControl {
  constructor(call, save, state = {}, savedEvent) {
    this.call = call; this.save = save; this.savedEvent = savedEvent;
    this.state = { clips: [], playback: null, suffix: crypto.randomUUID().slice(0, 8), error: '', ...state };
  }
  async persist(changes) { const next = { ...this.state, ...changes }; await this.save(next); Object.assign(this.state, changes); }
  get scene() { return `WEB_REPLAY_${this.state.suffix}`; }
  get source() { return `WEB_REPLAY_PLAYER_${this.state.suffix}`; }
  async prepare() {
    const { scenes } = await this.call('GetSceneList');
    if (!scenes.some(s => s.sceneName === this.scene)) await this.call('CreateScene', { sceneName: this.scene });
    const { inputs } = await this.call('GetInputList');
    if (!inputs.some(i => i.inputName === this.source)) await this.call('CreateInput', { sceneName: this.scene, inputName: this.source, inputKind: 'ffmpeg_source', inputSettings: { is_local_file: true, looping: false, restart_on_activate: true, close_when_inactive: false }, sceneItemEnabled: true });
    const { sceneItemId } = await this.call('GetSceneItemId', { sceneName: this.scene, sourceName: this.source });
    const video = await this.call('GetVideoSettings');
    await this.call('SetSceneItemTransform', { sceneName: this.scene, sceneItemId, sceneItemTransform: { positionX: 0, positionY: 0, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: video.baseWidth, boundsHeight: video.baseHeight, boundsAlignment: 5, alignment: 5 } });
    const label = `WEB_REPLAY_LABEL_${this.state.suffix}`;
    if (!inputs.some(i => i.inputName === label)) await this.call('CreateInput', { sceneName: this.scene, inputName: label, inputKind: 'text_gdiplus_v2', inputSettings: { text: 'REPETICIÓN', font: { face: 'Segoe UI', size: 36, flags: 1 }, color: 0xffffffff, bk_color: 0xff101c2a, bk_opacity: 100 }, sceneItemEnabled: true });
    const tag = await this.call('GetSceneItemId', { sceneName: this.scene, sourceName: label });
    await this.call('SetSceneItemTransform', { sceneName: this.scene, sceneItemId: tag.sceneItemId, sceneItemTransform: { positionX: video.baseWidth - 360, positionY: 64 } });
  }
  async capture(command) {
    if (this.state.playback) throw new Error('Vuelve al directo antes de guardar otra jugada.');
    const { outputActive } = await this.call('GetReplayBufferStatus');
    if (!outputActive) throw new Error('Inicia el búfer antes de guardar una jugada.');
    // Subscribe before requesting the save: GetLastReplayBufferReplay can still
    // refer to the previous clip while OBS finishes writing the new recording.
    const event = this.savedEvent();
    try {
      await this.call('SaveReplayBuffer');
      const localPath = await event.promise;
      if (!(await fs.stat(localPath)).isFile()) throw new Error('OBS no terminó de guardar el clip.');
      const clip = { id: crypto.randomUUID(), localPath, tournamentId: command.tournamentId, savedAt: new Date().toISOString() };
      await this.persist({ clips: [clip, ...this.state.clips.filter(c => c.localPath !== localPath)].slice(0, 50) });
    } finally { event.cancel(); }
  }
  async play(command) {
    const clip = this.state.clips.find(c => c.id === command.clipId && c.tournamentId === command.tournamentId);
    if (!clip || !(await fs.stat(clip.localPath).catch(() => null))?.isFile()) throw new Error('El clip ya no está disponible en la computadora de casa.');
    if (this.state.playback) await this.finish();
    await this.prepare();
    const { currentProgramSceneName } = await this.call('GetCurrentProgramScene');
    if (currentProgramSceneName === this.scene) throw new Error('Selecciona primero tu escena de directo en OBS.');
    await this.call('SetInputSettings', { inputName: this.source, inputSettings: { local_file: clip.localPath, is_local_file: true, looping: false, speed_percent: 100 }, overlay: true });
    await this.call('SetInputMute', { inputName: this.source, inputMuted: false });
    await this.persist({ playback: { clipId: clip.id, previousScene: currentProgramSceneName, startedAt: Date.now() } });
    try {
      await this.call('SetCurrentProgramScene', { sceneName: this.scene });
      await this.call('TriggerMediaInputAction', { inputName: this.source, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART' });
    } catch (error) { await this.finish().catch(() => {}); throw error; }
  }
  async finish() {
    const playback = this.state.playback;
    if (!playback) return;
    const { currentProgramSceneName } = await this.call('GetCurrentProgramScene');
    // Do not override a scene change the operator made directly in OBS.
    if (currentProgramSceneName === this.scene) await this.call('SetCurrentProgramScene', { sceneName: playback.previousScene });
    await this.call('TriggerMediaInputAction', { inputName: this.source, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP' }).catch(() => {});
    await this.persist({ playback: null });
  }
  async tick() {
    const playback = this.state.playback;
    if (!playback) return;
    const { currentProgramSceneName } = await this.call('GetCurrentProgramScene');
    if (currentProgramSceneName !== this.scene) { await this.persist({ playback: null }); return; }
    const media = await this.call('GetMediaInputStatus', { inputName: this.source });
    const elapsed = Date.now() - playback.startedAt;
    if (['OBS_MEDIA_STATE_ENDED', 'OBS_MEDIA_STATE_STOPPED', 'OBS_MEDIA_STATE_ERROR'].includes(media.mediaState) || (media.mediaDuration > 0 && elapsed > media.mediaDuration + 10000) || (!(media.mediaDuration > 0) && elapsed > 10000)) await this.finish();
  }
  async handle(command) {
    try {
      if (command.action === 'start') { const s = await this.call('GetReplayBufferStatus'); if (!s.outputActive) await this.call('StartReplayBuffer'); }
      else if (command.action === 'stop_buffer') await this.call('StopReplayBuffer');
      else if (command.action === 'save') await this.capture(command);
      else if (command.action === 'play') await this.play(command);
      else if (command.action === 'stop') await this.finish();
      else throw new Error('Acción de repetición no válida.');
      await this.persist({ error: '' });
    } catch (error) { await this.persist({ error: /Replay buffer is not available/i.test(error.message) ? 'Habilita el búfer de repetición en Ajustes → Salida de OBS.' : error.message }); }
  }
  async report() {
    let bufferAvailable = true, bufferActive = false;
    try { bufferActive = (await this.call('GetReplayBufferStatus')).outputActive; } catch { bufferAvailable = false; }
    return { bufferAvailable, bufferActive, playingClipId: this.state.playback?.clipId || null, error: this.state.error, clips: this.state.clips.map(({ id, tournamentId, savedAt }) => ({ id, tournamentId, savedAt })) };
  }
}
