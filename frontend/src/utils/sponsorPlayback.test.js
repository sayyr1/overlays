import { sponsorPlayback } from './sponsorPlayback';
const startedAt = new Date(0).toISOString();
const deck = { logos: { id: 'logos', startedAt, duration: 20, items: [{ sponsorId: 'a', kind: 'logo', name: 'A', duration: 10 }, { sponsorId: 'b', kind: 'logo', name: 'B', duration: 10 }] }, ads: { id: 'ads', startedAt: new Date(5000).toISOString(), duration: 30, items: [{ sponsorId: 'a', kind: 'video', name: 'A', duration: 12, muted: false }, { sponsorId: 'b', kind: 'video', name: 'B', duration: 18, muted: true }] } };
test('commercials play once in the lower strip with their audio preferences', () => {
  const first = sponsorPlayback(deck, 6000);
  expect(first.item.name).toBe('A');
  expect(first.layer.config).toMatchObject({ x: 96, y: 864, width: 1728, height: 152, muted: false, fit: 'contain' });
  expect(sponsorPlayback(deck, 17000).item.name).toBe('B');
  expect(sponsorPlayback(deck, 17000).layer.config.muted).toBe(true);
  expect(sponsorPlayback({ ads: deck.ads }, 35000).active).toBe(false);
});
test('logos resume their paused position when the last video completes', () => {
  expect(sponsorPlayback(deck, 35000)).toMatchObject({ mode: 'logos', item: { name: 'A' }, remaining: 5 });
  expect(sponsorPlayback(deck, 40000)).toMatchObject({ mode: 'logos', item: { name: 'B' } });
  expect(sponsorPlayback(deck, 50000).layer.config.muted).toBe(true);
  expect(sponsorPlayback({}, 100).active).toBe(false);
});
