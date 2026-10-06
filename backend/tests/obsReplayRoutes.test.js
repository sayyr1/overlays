import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import router from '../routes/obsReplay.js';
import SportsAdmin from '../models/SportsAdmin.js';
import Tournament from '../models/Tournament.js';
import ObsBridge from '../models/ObsBridge.js';

test('replay commands are authenticated, event-scoped and never accept file paths', async t => {
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = 'replay-route-test';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  t.mock.method(SportsAdmin, 'findById', async () => ({ active: true }));
  t.mock.method(Tournament, 'exists', async () => true);
  const event = '012345678901234567890123';
  const bridge = { heartbeatAt: new Date(), status: { connected: true, replay: { clips: [{ id: 'clip', tournamentId: event }] } }, commands: [] };
  let command;
  t.mock.method(ObsBridge, 'findOneAndUpdate', (filter, update) => {
    if (update.$push) command = update.$push.commands.$each[0];
    return { select: () => ({ lean: async () => bridge }) };
  });
  const app = express(); app.use(express.json()); app.use(router);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/obs/replay/control`;
  assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  const headers = { Authorization: `Bearer ${jwt.sign({ sub: event }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' };
  const send = body => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  assert.equal((await send({ action: 'play', tournamentId: event, clipId: 'unknown' })).status, 400);
  assert.equal((await send({ action: 'delete', tournamentId: event })).status, 400);
  assert.equal((await send({ action: 'play', tournamentId: event, clipId: 'clip', localPath: 'untrusted', sceneName: 'other' })).status, 200);
  assert.equal(command.kind, 'replay');
  assert.equal(command.clipId, 'clip');
  assert.equal('localPath' in command, false);
  assert.equal('sceneName' in command, false);
});
