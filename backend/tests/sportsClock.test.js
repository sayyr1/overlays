import test from 'node:test';
import assert from 'node:assert/strict';
import { currentElapsedSeconds, pauseClock, startClock, formatClock } from '../services/sportsClock.js';

test('el cronómetro calcula desde la marca temporal del servidor', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  assert.equal(currentElapsedSeconds({ elapsedSeconds: 120, running: true, startedAt }, new Date('2026-01-01T10:01:05Z')), 185);
});
test('pausar conserva el acumulado y elimina la marca de inicio', () => {
  const result = pauseClock({ elapsedSeconds: 3, running: true, startedAt: new Date('2026-01-01T10:00:00Z') }, new Date('2026-01-01T10:00:12Z'));
  assert.deepEqual(result, { elapsedSeconds: 15, running: false, startedAt: null });
});
test('iniciar no cambia el acumulado y formato es legible', () => {
  const result = startClock({ elapsedSeconds: 53, running: false, startedAt: null }, new Date('2026-01-01T10:00:00Z'));
  assert.equal(result.running, true); assert.equal(result.elapsedSeconds, 53); assert.equal(formatClock(125), '02:05');
});
