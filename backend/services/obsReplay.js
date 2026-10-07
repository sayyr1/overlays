import crypto from 'node:crypto';
import fs from 'node:fs/promises';
export function replayBadgeLayout(width, height) {
  const scale = Math.min(width / 1920, height / 1080);
  const x = width - 96 * scale - 560 * scale, y = 64 * scale;
  return { x, y, width: 560 * scale, height: 392 * scale, logoX: x + 20 * scale, logoY: y + 16 * scale, logoWidth: 520 * scale, logoHeight: 300 * scale, labelY: y + 328 * scale, labelHeight: 64 * scale, scale };
}

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
    for (const name of [`WEB_REPLAY_IMAGE_${this.state.suffix}`, `WEB_REPLAY_MOTION_${this.state.suffix}`, `WEB_REPLAY_PLATE_${this.state.suffix}`]) {
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
    const badge = replayBadgeLayout(baseWidth, baseHeight);
    if (placement === 'corner') {
      const plate = `WEB_REPLAY_PLATE_${this.state.suffix}`;
      const { inputKinds } = await this.call('GetInputKindList');
      const colorKind = inputKinds.find(kind => kind.startsWith('color_source'));
      if (colorKind) {
        const inputSettings = { color: 0xeb2a1c10, width: Math.round(badge.width), height: Math.round(branding.showLabel ? badge.height : 332 * badge.scale) };
        if (!inputs.some(input => input.inputName === plate)) await this.call('CreateInput', { sceneName: this.scene, inputName: plate, inputKind: colorKind, inputSettings, sceneItemEnabled: false });
        else await this.call('SetInputSettings', { inputName: plate, inputSettings, overlay: true });
        const item = await this.call('GetSceneItemId', { sceneName: this.scene, sourceName: plate });
        await this.call('SetSceneItemTransform', { sceneName: this.scene, sceneItemId: item.sceneItemId, sceneItemTransform: { positionX: badge.x, positionY: badge.y, alignment: 5, boundsType: 'OBS_BOUNDS_NONE', scaleX: 1, scaleY: 1 } });
        await this.call('SetSceneItemIndex', { sceneName: this.scene, sceneItemId: item.sceneItemId, sceneItemIndex: 1 });
        await this.visible(plate, true);
      }
    }
    const { sceneItemId } = await this.call('GetSceneItemId', { sceneName: this.scene, sourceName });
    await this.call('SetSceneItemTransform', { sceneName: this.scene, sceneItemId, sceneItemTransform: { positionX: placement === 'corner' ? badge.logoX : 0, positionY: placement === 'corner' ? badge.logoY : 0, alignment: 5, boundsAlignment: placement === 'corner' ? 0 : 5, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: placement === 'corner' ? badge.logoWidth : baseWidth, boundsHeight: placement === 'corner' ? badge.logoHeight : baseHeight } });
    const { sceneItems } = await this.call('GetSceneItemList', { sceneName: this.scene });
    await this.call('SetSceneItemIndex', { sceneName: this.scene, sceneItemId, sceneItemIndex: Math.max(1, sceneItems.length - 1) });
    const label = await this.call('GetSceneItemId', { sceneName: this.scene, sourceName: `WEB_REPLAY_LABEL_${this.state.suffix}` });
    await this.call('SetSceneItemTransform', { sceneName: this.scene, sceneItemId: label.sceneItemId, sceneItemTransform: { positionX: badge.x, positionY: placement === 'corner' ? badge.labelY : badge.y, alignment: 5, boundsAlignment: 0, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: badge.width, boundsHeight: badge.labelHeight } });
    await this.call('SetSceneItemIndex', { sceneName: this.scene, sceneItemId: label.sceneItemId, sceneItemIndex: Math.max(1, sceneItems.length - 1) });
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
    const badge = replayBadgeLayout(video.baseWidth, video.baseHeight);
    const labelSettings = { text: 'REPETICIÓN', font: { face: 'Segoe UI', size: Math.round(48 * badge.scale), flags: 1 }, color: 0xff2a1c10, color1: 0xff2a1c10, color2: 0xff2a1c10, opacity: 100, bk_color: 0xff05b7f2, bk_opacity: 100, extents: true, extents_cx: Math.round(badge.width), extents_cy: Math.round(badge.labelHeight), extents_wrap: false, align: 'center', valign: 'center', outline: false };
    if (!inputs.some(i => i.inputName === label)) {
      const { inputKinds } = await this.call('GetInputKindList');
      const textKind = inputKinds.find(kind => kind.startsWith('text_gdiplus')) || inputKinds.find(kind => kind.startsWith('text_ft2'));
      if (!textKind) throw new Error('OBS no tiene una fuente de texto para el rótulo de repetición.');
      await this.call('CreateInput', { sceneName: this.scene, inputName: label, inputKind: textKind, inputSettings: labelSettings, sceneItemEnabled: true });
    } else await this.call('SetInputSettings', { inputName: label, inputSettings: labelSettings, overlay: true });
    const tag = await this.call('GetSceneItemId', { sceneName: this.scene, sourceName: label });
    await this.call('SetSceneItemTransform', { sceneName: this.scene, sceneItemId: tag.sceneItemId, sceneItemTransform: { positionX: badge.x, positionY: badge.y, alignment: 5, boundsAlignment: 0, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: badge.width, boundsHeight: badge.labelHeight } });
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
      else if (['rename', 'delete'].includes(command.action)) {
        const clip = this.state.clips.find(c => c.id === command.clipId && c.tournamentId === command.tournamentId);
        if (!clip) throw new Error('La jugada ya no está disponible en este evento.');
        if (command.action === 'rename') {
          if (typeof command.name !== 'string' || !command.name.trim() || command.name.trim().length > 80) throw new Error('Escribe un nombre de 1 a 80 caracteres.');
          await this.persist({ clips: this.state.clips.map(c => c === clip ? { ...c, name: command.name.trim() } : c) });
        } else {
          if (this.state.playback?.clipId === clip.id) throw new Error('Vuelve al directo antes de eliminar la jugada en aire.');
          // Remove from the web library, retaining the original OBS recording.
          await this.persist({ clips: this.state.clips.filter(c => c !== clip) });
        }
      }
      else throw new Error('Acción de repetición no válida.');
      await this.persist({ error: '' });
    } catch (error) { await this.persist({ error: /Replay buffer is not available/i.test(error.message) ? 'Habilita el búfer de repetición en Ajustes → Salida de OBS.' : error.message }); }
  }
  async report() {
    let bufferAvailable = true, bufferActive = false;
    try { bufferActive = (await this.call('GetReplayBufferStatus')).outputActive; } catch { bufferAvailable = false; }
    return { bufferAvailable, bufferActive, playingClipId: this.state.playback?.clipId || null, error: this.state.error, clips: this.state.clips.map(({ id, tournamentId, savedAt, name }) => ({ id, tournamentId, savedAt, name })) };
  }
}
