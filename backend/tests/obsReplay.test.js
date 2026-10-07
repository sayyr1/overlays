import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ReplayControl } from '../services/obsReplay.js';

function fixture(state = {}, loadAsset) {
  let scene = 'LIVE', mediaState = 'OBS_MEDIA_STATE_PLAYING';
  const calls = [], saved = [];
  const replay = new ReplayControl(async (name, args) => {
    calls.push({ name, args });
    if (name === 'GetSceneList') return { scenes: [] };
    if (name === 'GetInputList') return { inputs: [] };
    if (name === 'GetInputKindList') return { inputKinds: ['text_gdiplus_v3', 'ffmpeg_source'] };
    if (name === 'GetSceneItemId') return { sceneItemId: 1 };
    if (name === 'GetVideoSettings') return { baseWidth: 1920, baseHeight: 1080 };
    if (name === 'GetCurrentProgramScene') return { currentProgramSceneName: scene };
    if (name === 'SetCurrentProgramScene') scene = args.sceneName;
    if (name === 'GetMediaInputStatus') return { mediaState, mediaDuration: 20000 };
    if (name === 'GetReplayBufferStatus') return { outputActive: true };
    return {};
  }, async next => saved.push(next), state, undefined, loadAsset);
  return { replay, calls, saved, scene: () => scene, changeScene: value => { scene = value; }, end: () => { mediaState = 'OBS_MEDIA_STATE_ENDED'; } };
}
async function clipFile(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'replay-test-'));
  const file = path.join(dir, 'clip.mp4'); await fs.writeFile(file, 'fixture');
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return file;
}
test('plays only a clip registered for the event and returns locally at the end', async t => {
  const localPath = await clipFile(t);
  const f = fixture({ clips: [{ id: 'clip', tournamentId: 'event', localPath }] });
  await assert.rejects(f.replay.play({ clipId: 'clip', tournamentId: 'other' }), /ya no está disponible/);
  await f.replay.play({ clipId: 'clip', tournamentId: 'event' });
  assert.equal(f.scene(), f.replay.scene);
  f.end(); await f.replay.tick();
  assert.equal(f.scene(), 'LIVE');
  assert.equal(f.replay.state.playback, null);
});
test('manual scene changes are preserved and replay reports never expose file paths', async t => {
  const localPath = await clipFile(t);
  const f = fixture({ clips: [{ id: 'clip', tournamentId: 'event', localPath, savedAt: new Date().toISOString() }] });
  await f.replay.play({ clipId: 'clip', tournamentId: 'event' });
  f.changeScene('OTHER'); await f.replay.finish();
  assert.equal(f.scene(), 'OTHER');
  assert.equal('localPath' in (await f.replay.report()).clips[0], false);
});
test('saving waits for the saved-file event and assigns the clip to its event', async t => {
  const localPath = await clipFile(t); const f = fixture();
  let cancelled = false;
  f.replay.savedEvent = () => ({ promise: Promise.resolve(localPath), cancel: () => { cancelled = true; } });
  await f.replay.capture({ tournamentId: 'event' });
  assert.equal(f.replay.state.clips[0].localPath, localPath);
  assert.equal(f.replay.state.clips[0].tournamentId, 'event');
  assert.equal(cancelled, true);
  f.replay.state.playback = {};
  await assert.rejects(f.replay.capture({ tournamentId: 'event' }), /Vuelve al directo/);
});
test('a disconnected OBS keeps the previous scene for recovery after restart', async () => {
  const f = fixture({ playback: { previousScene: 'LIVE', clipId: 'clip', startedAt: Date.now() } });
  f.changeScene(f.replay.scene);
  const call = f.replay.call;
  f.replay.call = async () => { throw new Error('offline'); };
  await assert.rejects(f.replay.finish(), /offline/);
  assert.equal(f.replay.state.playback.previousScene, 'LIVE');
  f.replay.call = call; await f.replay.finish();
  assert.equal(f.scene(), 'LIVE');
});

test('custom graphics use cached local files, stay muted and hide duplicate labels', async t => {
  const localPath = await clipFile(t);
  const f = fixture({ clips: [{ id: 'clip', tournamentId: 'event', localPath }] }, async () => localPath);
  await f.replay.play({ clipId: 'clip', tournamentId: 'event', branding: { asset: { kind: 'video' }, placement: 'overlay', showLabel: false } });
  const input = f.calls.find(c => c.name === 'CreateInput' && c.args.inputName.includes('_MOTION_'));
  assert.equal(input.args.inputSettings.local_file, localPath);
  assert.equal(input.args.inputSettings.looping, true);
  assert(f.calls.some(c => c.name === 'SetInputMute' && c.args.inputName.includes('_MOTION_') && c.args.inputMuted));
  assert.equal(f.replay.state.playback.graphic.showLabel, false);
});

test('intro completes before the clip starts and clip completion returns to live', async t => {
  const localPath = await clipFile(t);
  const f = fixture({ clips: [{ id: 'clip', tournamentId: 'event', localPath }] }, async () => localPath);
  await f.replay.play({ clipId: 'clip', tournamentId: 'event', branding: { asset: { kind: 'video', duration: 1 }, placement: 'intro', showLabel: false } });
  assert.equal(f.replay.state.playback.stage, 'intro');
  assert(!f.calls.some(c => c.name === 'TriggerMediaInputAction' && c.args.inputName === f.replay.source && c.args.mediaAction.endsWith('_RESTART')));
  f.end(); await f.replay.tick();
  assert.equal(f.replay.state.playback.stage, 'clip');
  assert.equal(f.scene(), f.replay.scene);
  assert(f.calls.some(c => c.name === 'TriggerMediaInputAction' && c.args.inputName === f.replay.source && c.args.mediaAction.endsWith('_RESTART')));
  await f.replay.tick(); assert.equal(f.scene(), 'LIVE');
});

test('graphic download failure leaves the live scene and recovery state unchanged', async t => {
  const localPath = await clipFile(t);
  const f = fixture({ clips: [{ id: 'clip', tournamentId: 'event', localPath }] }, async () => { throw new Error('download failed'); });
  await assert.rejects(f.replay.play({ clipId: 'clip', tournamentId: 'event', branding: { asset: { kind: 'video' } } }), /download failed/);
  assert.equal(f.scene(), 'LIVE'); assert.equal(f.replay.state.playback, null);
});

test('clip names persist across restarts and deletion removes only the registered library entry', async t => {
  const localPath = await clipFile(t);
  const f = fixture({ clips: [{ id: 'clip', tournamentId: 'event', localPath }, { id: 'other', tournamentId: 'other', localPath }] });
  await f.replay.handle({ action: 'rename', clipId: 'clip', tournamentId: 'other', name: 'Wrong event' });
  assert.equal(f.replay.state.clips[0].name, undefined);
  await f.replay.handle({ action: 'rename', clipId: 'clip', tournamentId: 'event', name: '   Gol minuto 24   ' });
  assert.equal((await f.replay.report()).clips[0].name, 'Gol minuto 24');
  const restarted = fixture(f.saved.at(-1));
  assert.equal((await restarted.replay.report()).clips[0].name, 'Gol minuto 24');
  restarted.replay.state.playback = { clipId: 'clip' };
  await restarted.replay.handle({ action: 'delete', clipId: 'clip', tournamentId: 'event' });
  assert.equal(restarted.replay.state.clips.length, 2);
  assert.match(restarted.replay.state.error, /en aire/);
  restarted.replay.state.playback = null;
  await restarted.replay.handle({ action: 'delete', clipId: 'clip', tournamentId: 'event' });
  assert.deepEqual(restarted.replay.state.clips.map(c => c.id), ['other']);
  assert.equal((await fs.stat(localPath)).isFile(), true);
});
