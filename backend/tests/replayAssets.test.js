import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cacheReplayAsset } from '../services/replayAssets.js';

test('replay graphics reject arbitrary URLs and cache bounded library downloads locally', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'replay-assets-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const asset = { kind: 'image', publicId: 'imbabura-en-vivo/library/01234567-0123-0123-0123-012345678901', secureUrl: 'https://res.cloudinary.com/cloud/image/upload/test.png', format: 'png' };
  let downloads = 0;
  t.mock.method(globalThis, 'fetch', async () => { downloads++; return new Response('fixture'); });
  await assert.rejects(cacheReplayAsset({ ...asset, secureUrl: 'http://localhost/private' }, directory), /recurso válido/);
  await assert.rejects(cacheReplayAsset({ ...asset, publicId: 'untrusted' }, directory), /recurso válido/);
  assert.equal(downloads, 0);
  const file = await cacheReplayAsset(asset, directory);
  assert.equal(await fs.readFile(file, 'utf8'), 'fixture');
  assert.equal(await cacheReplayAsset(asset, directory), file);
  assert.equal(downloads, 1);
});
