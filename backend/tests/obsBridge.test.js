import test from 'node:test';
import assert from 'node:assert/strict';
import { ObsBridgeRuntime } from '../services/obsBridgeRuntime.js';
import { remoteAudioView, remoteObsAudio, bridgeTokenHash } from '../services/remoteObsAudio.js';
import ObsBridge from '../models/ObsBridge.js';

const now = Date.now();
const ad = { ads: { startedAt: new Date(now).toISOString(), items: [{ kind: 'video', muted: false, duration: 20 }] } };
function runtimeFixture(state = {}) {
  let volume = 0.8, muted = false;
  const saves = [], calls = [];
  const runtime = new ObsBridgeRuntime(async (name, args) => {
    calls.push({ name, args });
    if (name === 'GetInputVolume') return { inputVolumeMul: volume };
    if (name === 'GetInputMute') return { inputMuted: muted };
    if (name === 'SetInputVolume') volume = args.inputVolumeMul;
    if (name === 'SetInputMute') muted = args.inputMuted;
  }, async next => { saves.push(structuredClone(next)); }, state);
  return { runtime, calls, saves, volume: () => volume, muted: () => muted };
}
const settings = { inputName: 'BELABOX_SRT', tournamentId: 'event', duckEnabled: true, ambientPercent: 15 };
test('the home runtime restores an advertisement without receiving another cloud message', async () => {
  const f = runtimeFixture();
  await f.runtime.receive({ settings, deck: ad, commands: [] }, 0);
  assert.equal(f.volume(), 0.15);
  f.runtime.now = () => now + 20001;
  await f.runtime.reconcile();
  assert.equal(f.volume(), 0.8);
});
test('manual commands survive polling retries and their mute is independent from ducking', async () => {
  const f = runtimeFixture();
  const command = { id: 'one', inputName: 'BELABOX_SRT', muted: true, volumePercent: 40, expiresAt: new Date(now + 20000).toISOString() };
  const payload = { settings, deck: ad, commands: [command] };
  await f.runtime.receive(payload, 0);
  await f.runtime.receive(payload, 0);
  assert.equal(f.calls.filter(call => call.name === 'SetInputMute').length, 1);
  assert.equal(f.muted(), true);
  assert.equal(f.volume(), 0.15);
  await f.runtime.receive({ settings, deck: {}, commands: [] }, 0);
  assert.equal(f.volume(), 0.4);
  assert.equal(f.muted(), true);
  assert.deepEqual(f.runtime.state.completed, ['one']);
});
test('expired remote commands are acknowledged without changing OBS', async () => {
  const f = runtimeFixture();
  await f.runtime.receive({ settings: { ...settings, duckEnabled: false }, deck: {}, commands: [{ id: 'expired', inputName: 'BELABOX_SRT', muted: true, expiresAt: new Date(now - 1000).toISOString() }] }, 0);
  assert.equal(f.muted(), false);
  assert.deepEqual(f.runtime.state.completed, ['expired']);
});
test('a clock offset and persisted recovery state work after the bridge restarts', async () => {
  const f = runtimeFixture();
  const future = { ads: { ...ad.ads, startedAt: new Date(now + 60000).toISOString() } };
  await f.runtime.receive({ settings, deck: future, commands: [] }, 60000);
  assert.equal(f.volume(), 0.15);
  const recovered = runtimeFixture(f.saves.at(-1));
  // Mimic OBS retaining the reduced volume through the agent restart.
  await recovered.runtime.call('SetInputVolume', { inputName: 'BELABOX_SRT', inputVolumeMul: 0.15 });
  recovered.runtime.now = () => now + 80001;
  await recovered.runtime.reconcile();
  assert.equal(recovered.volume(), 0.8);
});
test('remote status never exposes the pairing key and expires the connection heartbeat', () => {
  const bridge = { tokenHash: bridgeTokenHash('secret'), inputName: 'BELABOX_SRT', heartbeatAt: new Date(now), status: { connected: true, sourceAvailable: true, inputName: 'BELABOX_SRT', volumePercent: 80 }, commands: [] };
  const view = remoteAudioView(bridge, now);
  assert.equal(view.connected, true);
  assert.equal(view.paired, true);
  assert.equal('tokenHash' in view, false);
  assert.equal(remoteAudioView(bridge, now + 15001).connected, false);
});
test('remote manual commands require a fresh source and are constrained and expiring', async t => {
  const bridge = { key: 'home', tokenHash: 'hash', inputName: 'BELABOX_SRT', heartbeatAt: new Date(), status: { connected: true, sourceAvailable: true, inputName: 'BELABOX_SRT' }, commands: [] };
  let update;
  t.mock.method(ObsBridge, 'findOneAndUpdate', (filter, changes) => {
    if (changes.$push) update = changes;
    return { select: () => ({ lean: async () => bridge }) };
  });
  await remoteObsAudio.update({ muted: true });
  const command = update.$push.commands.$each[0];
  assert.equal(command.muted, true);
  assert.equal(command.inputName, 'BELABOX_SRT');
  assert.ok(command.expiresAt.getTime() > Date.now());
  bridge.heartbeatAt = new Date(Date.now() - 20000);
  await assert.rejects(remoteObsAudio.update({ volumePercent: 90 }), /no está conectado/);
});
