import test from 'node:test';
import assert from 'node:assert/strict';
import cloudinary from '../utils/cloudinary.js';
import MediaAsset from '../models/MediaAsset.js';
import { ensureVideoDuration } from '../services/mediaMetadata.js';
test('legacy video duration is recovered from provider metadata and cached', async t => {
  let calls = 0;
  t.mock.method(cloudinary.api, 'resource', async (id, options) => { calls++; assert.equal(options.media_metadata, true); return { duration: 9.9 }; });
  let update;
  t.mock.method(MediaAsset, 'updateOne', async (filter, value) => { update = value; });
  const repaired = await ensureVideoDuration({ _id: 'asset', kind: 'video', publicId: 'original', name: 'Anuncio' });
  assert.equal(repaired.duration, 9.9);
  assert.deepEqual(update, { $set: { duration: 9.9 } });
  await ensureVideoDuration(repaired);
  assert.equal(calls, 1);
});
