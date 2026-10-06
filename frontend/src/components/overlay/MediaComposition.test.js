import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import OverlayComposition from './OverlayComposition';
import MediaComposition from './MediaComposition';

const start = new Date('2026-09-28T12:00:00Z').getTime();
const layer = { id: 'one', slot: '0', name: 'Frame', kind: 'image', visible: true, playing: true, secureUrl: 'https://example.com/frame.png', activatedAt: new Date(start).toISOString(), config: { x: 100, y: 800, width: 1000, height: 200, zIndex: 20, opacity: 0.5, fit: 'contain', title: 'Juan Pérez', subtitle: 'Invitado', textDelay: 1, textX: 40, textY: 20, fontSize: 44, endBehavior: 'hide' } };
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(start); jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(); jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
test('media renders without an active match and expires without receiving another snapshot', () => {
  const { container } = render(<OverlayComposition snapshot={{ mediaLayers: { 0: { ...layer, expiresAt: new Date(start + 3000).toISOString() } } }} />);
  expect(container.querySelector('img')).toHaveAttribute('src', layer.secureUrl);
  expect(container.querySelector('.tv-media-layer')).toHaveStyle({ left: '100px', opacity: '0.5' });
  expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(2000));
  expect(container.querySelector('.tv-media-layer')).toBeNull();
});
test.each(['hide', 'hold', 'text'])('video end policy %s survives a reload after the clip finished', policy => {
  const video = { ...layer, kind: 'video', mediaDuration: 2, config: { ...layer.config, endBehavior: policy } };
  const { container } = render(<MediaComposition layers={{ 0: video }} now={start + 3000} preview />);
  expect(Boolean(container.querySelector('.tv-media-layer'))).toBe(policy !== 'hide');
  expect(Boolean(container.querySelector('video'))).toBe(policy === 'hold');
  expect(Boolean(screen.queryByText('Juan Pérez'))).toBe(policy !== 'hide');
});
test('hidden layers disappear independently and stopped clips keep their first frame', () => {
  const { container } = render(<MediaComposition layers={{ 0: { ...layer, visible: false }, 1: { ...layer, id: 'two', slot: '1', kind: 'video', playing: false, mediaDuration: 2 } }} now={start + 3000} preview />);
  expect(container.querySelectorAll('.tv-media-layer')).toHaveLength(1);
  expect(container.querySelector('video')).not.toBeNull();
});
test('a reconnect seeks to elapsed time; STOP returns to frame zero and pauses', () => {
  jest.setSystemTime(start + 4000);
  const playing = { ...layer, kind: 'video', mediaDuration: 20 };
  const { container, rerender } = render(<MediaComposition layers={{ 0: playing }} now={start + 4000} preview />);
  const video = container.querySelector('video');
  Object.defineProperty(video, 'duration', { configurable: true, value: 20 });
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(4);
  expect(video.play).toHaveBeenCalled();
  rerender(<MediaComposition layers={{ 0: { ...playing, playing: false } }} now={start + 4000} preview />);
  expect(video.currentTime).toBe(0);
  expect(video.pause).toHaveBeenCalled();
});

test('OBS output applies audio before playback and updates when mute changes', () => {
  const playing = { ...layer, kind: 'video', mediaDuration: 20, config: { ...layer.config, muted: false } };
  const { container, rerender } = render(<MediaComposition layers={{ 0: playing }} now={start} />);
  const video = container.querySelector('video');
  Object.defineProperty(video, 'duration', { configurable: true, value: 20 });
  video.play.mockImplementation(() => {
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(1);
    return Promise.resolve();
  });
  fireEvent.loadedMetadata(video);
  expect(video.play).toHaveBeenCalled();
  video.play.mockResolvedValue();
  rerender(<MediaComposition layers={{ 0: { ...playing, config: { ...playing.config, muted: true } } }} now={start} />);
  expect(video.muted).toBe(true);
  rerender(<MediaComposition layers={{ 0: playing }} now={start} preview />);
  expect(video.muted).toBe(true);
  rerender(<MediaComposition layers={{ 0: playing }} now={start} />);
  expect(video.muted).toBe(false);
});
