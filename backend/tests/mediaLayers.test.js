import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaLayerChanges } from '../services/mediaLayers.js';

const asset = { _id: 'asset', name: 'Entrada', kind: 'video', secureUrl: 'https://example.com/original.webm', duration: 6 };
const now = new Date('2026-09-28T12:00:00Z');
test('media snapshots retain original URL, dynamic text and server expiration', () => {
  const config = { title: 'Juan', subtitle: 'Invitado', duration: 10, zIndex: 2, endBehavior: 'text' };
  const changes = mediaLayerChanges({ action: 'take', slot: '3', config }, asset, now);
  const layer = changes['mediaLayers.3'];
  config.title = 'Changed';
  assert.equal(layer.config.title, 'Juan');
  assert.equal(layer.secureUrl, asset.secureUrl);
  assert.equal(layer.expiresAt.toISOString(), '2026-09-28T12:00:10.000Z');
  assert.equal(layer.config.zIndex, 2);
  assert.equal(layer.config.endBehavior, 'text');
  assert.deepEqual(Object.keys(changes), ['mediaLayers.3']);
});
test('independent stop and hide do not overwrite other layers or dynamic graphics', () => {
  assert.deepEqual(mediaLayerChanges({ action: 'stop', slot: '0' }), { 'mediaLayers.0.playing': false });
  assert.deepEqual(mediaLayerChanges({ action: 'hide', slot: '15' }), { 'mediaLayers.15.visible': false });
  assert.equal(mediaLayerChanges({ action: 'take', slot: '0' }, asset, now)['mediaLayers.0'].expiresAt, null);
  assert.notEqual(mediaLayerChanges({ action: 'restart', slot: '0' }, asset, now)['mediaLayers.0'].id, mediaLayerChanges({ action: 'restart', slot: '0' }, asset, now)['mediaLayers.0'].id);
});
test('malformed commands and layout values cannot update arbitrary state', () => {
  for (const input of [
    { action: 'take', slot: '__proto__' }, { action: 'hide', slot: '0.visible' },
    { action: 'take', slot: '16' }, { action: 'unknown', slot: '0' },
    ...[{ opacity: 2 }, { width: 0 }, { x: 'bad' }, { duration: -1 }, { fit: 'invalid' }, { endBehavior: 'invalid' }].map(config => ({ action: 'take', slot: '0', config })),
  ]) assert.throws(() => mediaLayerChanges(input, asset), e => e.status === 400);
  assert.throws(() => mediaLayerChanges({ action: 'take', slot: '0' }, null), e => e.status === 400);
});
