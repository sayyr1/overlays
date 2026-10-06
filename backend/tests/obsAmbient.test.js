import test from 'node:test';
import assert from 'node:assert/strict';
import { AmbientControl, audibleCommercial } from '../services/obsAmbient.js';

const deck = { ads: { startedAt: new Date(1000).toISOString(), items: [{ kind: 'video', muted: false, duration: 5 }, { kind: 'video', muted: true, duration: 5 }, { kind: 'logo', duration: 5 }] } };
test('only the currently playing audible commercial lowers the field', () => {
  assert.equal(audibleCommercial(deck, 0), false);
  assert.equal(audibleCommercial(deck, 1000), true);
  assert.equal(audibleCommercial(deck, 5999), true);
  assert.equal(audibleCommercial(deck, 6000), false);
  assert.equal(audibleCommercial(deck, 11000), false);
  assert.equal(audibleCommercial(deck, 16000), false);
  assert.equal(audibleCommercial({ logos: deck.ads }, 1000), false);
});
function fixture(initial = 0.8, settings = {}) {
  let volume = initial;
  const calls = []; const saved = [];
  const control = new AmbientControl(async (name, args) => {
    calls.push({ name, args });
    if (name === 'GetInputVolume') return { inputVolumeMul: volume };
    if (name === 'SetInputVolume') volume = args.inputVolumeMul;
  }, async changes => { saved.push(changes); }, { inputName: 'BELABOX_SRT', ambientPercent: 15, restoreVolume: null, appliedVolume: null, ...settings });
  return { control, calls, saved, getVolume: () => volume, externalVolume: value => { volume = value; } };
}
test('commercials lower volume, preserve baseline across interruptions, and restore without touching mute', async () => {
  const f = fixture();
  await f.control.reconcile(true);
  assert.equal(f.getVolume(), 0.15);
  assert.equal(f.control.settings.restoreVolume, 0.8);
  await f.control.reconcile(true);
  assert.equal(f.control.settings.restoreVolume, 0.8);
  await f.control.reconcile(false);
  assert.equal(f.getVolume(), 0.8);
  assert.equal(f.control.settings.restoreVolume, null);
  assert.equal(f.calls.some(c => /Mute/.test(c.name)), false);
});
test('a reconnect restores persisted volume after the advertisement ended', async () => {
  const f = fixture(0.15, { restoreVolume: 0.7, appliedVolume: 0.15 });
  await f.control.reconcile(false);
  assert.equal(f.getVolume(), 0.7);
});
test('volume adjustments during a commercial change the restoration level and never raise a quieter field', async () => {
  const f = fixture();
  await f.control.reconcile(true);
  await f.control.manualVolume(40, true);
  assert.equal(f.getVolume(), 0.15);
  await f.control.reconcile(false);
  assert.equal(f.getVolume(), 0.4);
  await f.control.manualVolume(5, false);
  await f.control.reconcile(true);
  assert.equal(f.getVolume(), 0.05);
  await f.control.reconcile(false);
  assert.equal(f.getVolume(), 0.05);
});
test('an adjustment made in OBS after ducking is not overwritten on restoration', async () => {
  const f = fixture();
  await f.control.reconcile(true);
  f.externalVolume(0.5);
  await f.control.reconcile(false);
  assert.equal(f.getVolume(), 0.5);
});
test('failed restoration keeps the recovery baseline for the next retry', async () => {
  const f = fixture();
  await f.control.reconcile(true);
  const call = f.control.call;
  f.control.call = async (name, args) => { if (name === 'SetInputVolume') throw new Error('offline'); return call(name, args); };
  await assert.rejects(f.control.reconcile(false), /offline/);
  assert.equal(f.control.settings.restoreVolume, 0.8);
  f.control.call = call;
  await f.control.reconcile(false);
  assert.equal(f.getVolume(), 0.8);
});
