import crypto from 'node:crypto';
import fs from 'node:fs/promises';

export class ReplayControl {
  constructor(call, save, state = {}, savedEvent, loadAsset) {
    this.call = call; this.save = save; this.savedEvent = savedEvent; this.loadAsset = loadAsset;
    this.state = { clips: [], playback: null, suffix: crypto.randomUUID().slice(0, 8), error: '', ...state };
  }
  async persist(changes) { const next = { ...this.state, ...changes }; await this.save(next); Object.assign(this.state, changes); }
  get scene() { return `WEB_REPLAY_${this.state.suffix}`; }
  get source() { return `WEB_REPLAY_PLAYER_${this.state.suffix}`; }
  async visible(sourceName, sceneItemEnabled) {
    const { sceneItemId } = await this.call('GetSceneItemId', { sceneName: this.scene, sourceName });
    await this.call('SetSceneItemEnabled', { sceneName: this.scene, sceneItemId, sceneItemEnabled });
  }
  async prepareBranding(branding) {
    const { inputs } = await this.call('GetInputList');
    for (const name of [`WEB_REPLAY_IMAGE_${this.state.suffix}`, `WEB_REPLAY_MOTION_${this.state.suffix}`]) {
      if (inputs.some(i => i.inputName === name)) {
        await this.visible(name, false);
        if (name.includes('_MOTION_')) await this.call('TriggerMediaInputAction', { inputName: name, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP' });
      }
    }
    const placement = branding?.placement || 'corner';
    if (!branding?.asset) { await this.visible(`WEB_REPLAY_LABEL_${this.state.suffix}`, branding?.showLabel !== false); return null; }
    if (!this.loadAsset) throw new Error('Actualiza el puente para mostrar tu animación.');
    const localPath = await this.loadAsset(branding.asset);
    const video = branding.asset.kind === 'video';
    const sourceName = `WEB_REPLAY_${video ? 'MOTION' : 'IMAGE'}_${this.state.suffix}`;
    const settings = video ? { local_file: localPath, is_local_file: true, looping: placement !== 'intro', restart_on_activate: true, close_when_inactive: false, speed_percent: 100 } : { file: localPath };
    if (!inputs.some(i => i.inputName === sourceName)) await this.call('CreateInput', { sceneName: this.scene, inputName: sourceName, inputKind: video ? 'ffmpeg_source' : 'image_source', inputSettings: settings, sceneItemEnabled: false });
    else await this.call('SetInputSettings', { inputName: sourceName, inputSettings: settings, overlay: true });
    if (video) await this.call('SetInputMute', { inputName: sourceName, inputMuted: true });
    const { baseWidth, baseHeight } = await this.call('GetVideoSettings');
    const { sceneItemId } = await this.call('GetSceneItemId', { sceneName: this.scene, sourceName });
    await this.call('SetSceneItemTransform', { sceneName: this.scene, sceneItemId, sceneItemTransform: { positionX: placement === 'corner' ? baseWidth - 360 : 0, positionY: placement === 'corner' ? 120 : 0, alignment: 5, boundsAlignment: 5, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: placement === 'corner' ? 300 : baseWidth, boundsHeight: placement === 'corner' ? 160 : baseHeight } });
    await this.call('SetSceneItemIndex', { sceneName: this.scene, sceneItemId, sceneItemIndex: 1 });
    await this.visible(`WEB_REPLAY_LABEL_${this.state.suffix}`, placement !== 'intro' && branding.showLabel === true);
    return { sourceName, video, placement, showLabel: branding.showLabel === true, duration: branding.asset.duration };
  }
  async prepare() {
    const { scenes } = await this.call('GetSceneList');
    if (!scenes.some(s => s.sceneName === this.scene)) await this.call('CreateScene', { sceneName: this.scene });
    const { inputs } = await this.call('GetInputList');
    if (!inputs.some(i => i.inputName === this.source)) await this.call('CreateInput', { sceneName: this.scene, inputName: this.source, inputKind: 'ffmpeg_source', inputSettings: { is_local_file: true, looping: false, restart_on_activate: true, close_when_inactive: false }, sceneItemEnabled: true });
    const { sceneItemId } = await this.call('GetSceneItemId', { sceneName: this.scene, sourceName: this.source });
    const video = await this.call('GetVideoSettings');
    await this.call('SetSceneItemTransform', { sceneName: this.scene, sceneItemId, sceneItemTransform: { positionX: 0, positionY: 0, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: video.baseWidth, boundsHeight: video.baseHeight, boundsAlignment: 5, alignment: 5 } });
    const label = `WEB_REPLAY_LABEL_${this.state.suffix}`;
    if (!inputs.some(i => i.inputName === label)) {
      const { inputKinds } = await this.call('GetInputKindList');
      const textKind = inputKinds.find(kind => kind.startsWith('text_gdiplus')) || inputKinds.find(kind => kind.startsWith('text_ft2'));
      if (!textKind) throw new Error('OBS no tiene una fuente de texto para el rótulo de repetición.');
      await this.call('CreateInput', { sceneName: this.scene, inputName: label, inputKind: textKind, inputSettings: { text: 'REPETICIÓN', font: { face: 'Segoe UI', size: 36, flags: 1 }, color: 0xffffffff, bk_color: 0xff101c2a, bk_opacity: 100 }, sceneItemEnabled: true });
    }
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
    const graphic = await this.prepareBranding(command.branding);
    const { currentProgramSceneName } = await this.call('GetCurrentProgramScene');
    if (currentProgramSceneName === this.scene) throw new Error('Selecciona primero tu escena de directo en OBS.');
    await this.call('SetInputSettings', { inputName: this.source, inputSettings: { local_file: clip.localPath, is_local_file: true, looping: false, speed_percent: 100 }, overlay: true });
    await this.call('SetInputMute', { inputName: this.source, inputMuted: false });
    const intro = graphic?.placement === 'intro';
    await this.visible(this.source, !intro);
    if (graphic) await this.visible(graphic.sourceName, true);
    await this.persist({ playback: { clipId: clip.id, previousScene: currentProgramSceneName, startedAt: Date.now(), stage: intro ? 'intro' : 'clip', graphic } });
    try {
      await this.call('SetCurrentProgramScene', { sceneName: this.scene });
      if (graphic?.video) await this.call('TriggerMediaInputAction', { inputName: graphic.sourceName, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART' });
      await this.call('TriggerMediaInputAction', { inputName: this.source, mediaAction: intro ? 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP' : 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART' });
    } catch (error) { await this.finish().catch(() => {}); throw error; }
  }
  async finish() {
    const playback = this.state.playback;
    if (!playback) return;
    const { currentProgramSceneName } = await this.call('GetCurrentProgramScene');
    // Do not override a scene change the operator made directly in OBS.
    if (currentProgramSceneName === this.scene) await this.call('SetCurrentProgramScene', { sceneName: playback.previousScene });
    await this.call('TriggerMediaInputAction', { inputName: this.source, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP' }).catch(() => {});
    if (playback.graphic?.video) await this.call('TriggerMediaInputAction', { inputName: playback.graphic.sourceName, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP' }).catch(() => {});
    await this.persist({ playback: null });
  }
  async tick() {
    const playback = this.state.playback;
    if (!playback) return;
    const { currentProgramSceneName } = await this.call('GetCurrentProgramScene');
    if (currentProgramSceneName !== this.scene) { await this.finish(); return; }
    if (playback.stage === 'intro') {
      const media = await this.call('GetMediaInputStatus', { inputName: playback.graphic.sourceName });
      if (['OBS_MEDIA_STATE_ENDED', 'OBS_MEDIA_STATE_STOPPED', 'OBS_MEDIA_STATE_ERROR'].includes(media.mediaState) || Date.now() - playback.startedAt > Math.min(10, playback.graphic.duration || 10) * 1000 + 1000) {
        await this.visible(playback.graphic.sourceName, false);
        await this.visible(this.source, true);
        await this.visible(`WEB_REPLAY_LABEL_${this.state.suffix}`, playback.graphic.showLabel);
        await this.call('TriggerMediaInputAction', { inputName: this.source, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART' });
        await this.persist({ playback: { ...playback, stage: 'clip', startedAt: Date.now() } });
      }
      return;
    }
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
