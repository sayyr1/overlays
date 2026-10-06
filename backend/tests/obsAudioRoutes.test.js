import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import router from '../routes/obsAudio.js';
import SportsAdmin from '../models/SportsAdmin.js';
import Tournament from '../models/Tournament.js';
import { obsAudio } from '../services/obsAudioService.js';

test('OBS audio is admin-only, validates volumes and limits commands to audio', async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'local-obs-audio-test';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  t.mock.method(SportsAdmin, 'findById', async () => ({ _id: '012345678901234567890123', active: true }));
  t.mock.method(Tournament, 'exists', async () => true);
  t.mock.method(obsAudio, 'status', async () => ({ connected: false, message: 'Activa WebSocket' }));
  let changes;
  t.mock.method(obsAudio, 'update', async input => { changes = input; return { connected: true, muted: true }; });
  const app = express(); app.use(express.json()); app.use(router);
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/obs/audio`;
  assert.equal((await fetch(base)).status, 401);
  assert.equal((await fetch(base, { method: 'PATCH' })).status, 401);
  const token = jwt.sign({ sub: '012345678901234567890123' }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  assert.equal((await fetch(base, { headers })).status, 200);
  for (const input of [{ volumePercent: -1 }, { ambientPercent: 101 }, { muted: 'false' }, { tournamentId: 'bad' }]) {
    assert.equal((await fetch(base, { method: 'PATCH', headers, body: JSON.stringify(input) })).status, 400);
  }
  const input = { muted: true, volumePercent: 40, ambientPercent: 15, duckEnabled: true, tournamentId: '012345678901234567890123', url: 'ws://untrusted', password: 'ignored', requestType: 'StopStream' };
  assert.equal((await fetch(base, { method: 'PATCH', headers, body: JSON.stringify(input) })).status, 200);
  assert.deepEqual(changes, { muted: true, volumePercent: 40, ambientPercent: 15, duckEnabled: true, tournament: input.tournamentId });
});
