import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ReplayControl } from '../services/obsReplay.js';

function fixture(state = {}) {
  let scene = 'LIVE', mediaState = 'OBS_MEDIA_STATE_PLAYING';
  const calls = [], saved = [];
  const replay = new ReplayControl(async (name, args) => {
    calls.push({ name, args });
    if (name === 'GetSceneList') return { scenes: [] };
    if (name === 'GetInputList') return { inputs: [] };
    if (name === 'GetSceneItemId') return { sceneItemId: 1 };
    if (name === 'GetVideoSettings') return { baseWidth: 1920, baseHeight: 1080 };
    if (name === 'GetCurrentProgramScene') return { currentProgramSceneName: scene };
    if (name === 'SetCurrentProgramScene') scene = args.sceneName;
    if (name === 'GetMediaInputStatus') return { mediaState, mediaDuration: 20000 };
    if (name === 'GetReplayBufferStatus') return { outputActive: true };
    return {};
  }, async next => saved.push(next), state);
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
