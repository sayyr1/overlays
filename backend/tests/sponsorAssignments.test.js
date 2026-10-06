import test from 'node:test';
import assert from 'node:assert/strict';
import { forTournament } from '../services/sponsorAssignments.js';
test('legacy sponsors remain confirmed and tournament settings stay independent', () => {
 const legacy = { tournament: 'one', active: true, order: 2, durationSeconds: 12 };
 assert.equal(forTournament(legacy, 'one').confirmed, true);
 const sponsor = { ...legacy, assignments: [{ tournament: 'one', confirmed: false, active: true, order: 8, durationSeconds: 15 }, { tournament: 'two', confirmed: true, active: true, order: 1, durationSeconds: 30 }] };
 assert.equal(forTournament(sponsor, 'one').confirmed, false);
 assert.equal(forTournament(sponsor, 'two').durationSeconds, 30);
 assert.equal(forTournament({ ...sponsor, active: false }, 'two').active, false);
});
