import test from 'node:test';
import assert from 'node:assert/strict';
import { sponsorDeckChanges, sponsorPiece } from '../services/sponsorDeck.js';
import MediaAsset from '../models/MediaAsset.js';
const logo = { id: 'logo', kind: 'logo', name: 'Marca', duration: 10, muted: true };
const video = { id: 'video', kind: 'video', name: 'Anuncio', duration: 24, muted: false };
test('logos rotate separately and commercials preserve their full duration', () => {
  const first = sponsorDeckChanges({}, { action: 'logos' }, [logo], new Date(0));
  assert.equal(first.sponsorDeck.logos.duration, 10);
  const ad = sponsorDeckChanges(first.sponsorDeck, { action: 'ads' }, [video], new Date(4000));
  assert.equal(ad.sponsorDeck.ads.duration, 24);
  assert.equal(ad.sponsorDeck.ads.items[0].muted, false);
  assert.equal(ad.sponsorDeck.logos.startedAt, new Date(0).toISOString());
  assert.equal(ad.sponsorBugVisible, false);
  assert.equal(ad['mediaLayers.15.visible'], false);
  assert.equal(ad.scoreboardVisible, undefined);
  assert.equal(ad.clockVisible, undefined);
});
test('manual interruption freezes logo progress and stop clears all advertising', () => {
  const logos = sponsorDeckChanges({}, { action: 'logos' }, [logo], new Date(0)).sponsorDeck;
  const ads = sponsorDeckChanges(logos, { action: 'ads' }, [video], new Date(4000)).sponsorDeck;
  const manual = sponsorDeckChanges(ads, { action: 'manual_logo' }, [logo], new Date(9000)).sponsorDeck;
  assert.equal(manual.logos.startedAt, new Date(5000).toISOString());
  assert.equal(manual.ads.duration, 10);
  assert.deepEqual(sponsorDeckChanges(manual, { action: 'stop' }, []).sponsorDeck, {});
  assert.throws(() => sponsorDeckChanges({}, { action: 'ads' }, []), /No hay piezas/);
  assert.throws(() => sponsorDeckChanges({}, { action: 'invalid' }, [logo]), /Acción/);
});
test('video scheduling uses provider duration, never the logo duration', async t => {
  t.mock.method(MediaAsset, 'findById', () => ({ lean: async () => ({ kind: 'video', duration: 37.25, secureUrl: '/ad.mp4' }) }));
  const sponsor = { _id: 'brand', name: 'Marca', mediaVideo: '012345678901234567890123', durationSeconds: 5, videoMuted: false, logo: { secureUrl: '/logo.png' } };
  assert.equal((await sponsorPiece(sponsor, 'video')).duration, 37.25);
  assert.equal((await sponsorPiece(sponsor, 'video')).muted, false);
  const logoPiece = await sponsorPiece(sponsor, 'logo');
  assert.equal(logoPiece.duration, 5);
  assert.equal(logoPiece.muted, true);
  t.mock.method(MediaAsset, 'findById', () => ({ lean: async () => ({ kind: 'video', duration: 0, secureUrl: '/ad.mp4' }) }));
  assert.equal(await sponsorPiece(sponsor, 'video'), null);
});
