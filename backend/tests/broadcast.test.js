import test from 'node:test';
import assert from 'node:assert/strict';
import { broadcastChanges, defaultBroadcastScenes } from '../services/broadcastConfig.js';
import Tournament from '../models/Tournament.js';

test('los proyectos existentes conservan el modo deportivo', () => {
  const tournament = new Tournament({ name: 'Copa', slug: 'copa' });
  assert.equal(tournament.mode, 'sports');
  assert.deepEqual(defaultBroadcastScenes('sports', 'Copa'), []);
  assert.throws(() => broadcastChanges({ mode: 'sports' }, { action: 'take' }), /deportivo/);
});

test('una presentación tiene plantillas independientes y no requiere partido', () => {
  const first = defaultBroadcastScenes('presentation', 'Conferencia');
  const second = defaultBroadcastScenes('presentation', 'Otro evento');
  assert.equal(first.length, 8);
  assert.notEqual(first[0].id, second[0].id);
  assert.equal(first[0].title, 'Conferencia');
  const tournament = new Tournament({ name: 'Conferencia', slug: 'conferencia', mode: 'presentation', broadcast: { scenes: first } });
  assert.equal(tournament.validateSync(), undefined);
  const state = broadcastChanges(tournament, { action: 'take', sceneId: first[0].id });
  assert.equal(state.mainGraphic.type, 'broadcast_opening');
  assert.equal(state.mainGraphic.data.title, 'Conferencia');
  assert.equal(state.lowerThird, null);
  assert.equal(state.scoreboardVisible, false);
});

test('la emisión congela los textos y calcula la caducidad desde el servidor', () => {
  const scene = { id: 'notice', type: 'announcement', title: 'Aviso original', duration: 10 };
  const now = new Date('2026-09-11T12:00:00Z');
  const changes = broadcastChanges({ mode: 'irl', broadcast: { scenes: [scene] } }, { action: 'take', sceneId: 'notice' }, now);
  scene.title = 'Edición posterior';
  assert.equal(changes.temporaryGraphic.data.title, 'Aviso original');
  assert.equal(changes.temporaryGraphic.expiresAt.toISOString(), '2026-09-11T12:00:10.000Z');
  assert.equal(changes.mainGraphic, undefined);
});

test('se rechazan gráficos sin completar, acciones desconocidas y capas arbitrarias', () => {
  const tournament = { mode: 'irl', broadcast: { scenes: [{ id: 'blank', type: 'speaker', title: '' }] } };
  for (const input of [{ action: 'take', sceneId: 'missing' }, { action: 'take', sceneId: 'blank' }, { action: 'goal_home' }, { action: 'hide', layer: 'revision' }, { action: 'hide', layer: '__proto__' }]) {
    assert.throws(() => broadcastChanges(tournament, input), error => error.status === 400);
  }
});

test('volver a cámara retira la placa y limpiar retira todas las capas', () => {
  assert.deepEqual(broadcastChanges({ mode: 'general' }, { action: 'hide', layer: 'main' }), { mainGraphic: null });
  const result = broadcastChanges({ mode: 'general' }, { action: 'clear' });
  assert.equal(result.mainGraphic, null);
  assert.equal(result.lowerThird, null);
  assert.equal(result.temporaryGraphic, null);
  assert.equal(result.sponsorBugVisible, false);
});

test('el esquema limita la biblioteca, los tipos y la longitud del texto', () => {
  const build = scenes => new Tournament({ name: 'IRL', slug: 'irl', mode: 'irl', broadcast: { scenes } });
  const scene = { id: 'one', type: 'speaker', label: 'Invitado', title: 'Persona' };
  assert.ok(build([scene, scene]).validateSync());
  assert.ok(build([{ ...scene, title: 'x'.repeat(101) }]).validateSync());
  assert.ok(build([{ ...scene, type: 'unknown' }]).validateSync());
  assert.ok(build(Array.from({ length: 31 }, (_, i) => ({ ...scene, id: String(i) }))).validateSync());
});
