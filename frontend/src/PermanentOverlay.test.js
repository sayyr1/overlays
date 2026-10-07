import React from 'react';
import { act, render, screen } from '@testing-library/react';
import App from './App';
jest.mock('./components/overlay/OverlayComposition', () => ({ snapshot }) => <div>{snapshot?.tournament?.name || 'Salida vacía'}</div>);

test('the same browser URL switches to an event with a lower state revision and reports the observed event', async () => {
  jest.useFakeTimers();
  window.history.pushState({}, '', '/overlay/programa?token=permanent');
  let event = 'A';
  global.fetch = jest.fn(async url => ({ ok: true, status: 200, json: async () => ({ outputRevision: event === 'A' ? 1 : 2, snapshot: { tournamentId: event, revision: event === 'A' ? 100 : 1, tournament: { name: `Evento ${event}` } } }) }));
  const view = render(<App />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByText('Evento A')).toBeInTheDocument();
  event = 'B';
  await act(async () => { jest.advanceTimersByTime(2100); });
  expect(screen.getByText('Evento B')).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(2000); });
  const heartbeat = global.fetch.mock.calls.filter(([url]) => String(url).includes('/overlay/output/heartbeat')).at(-1);
  expect(JSON.parse(heartbeat[1].body)).toEqual({ outputRevision: 2, tournamentId: 'B', stateRevision: 1 });
  expect(window.location.pathname).toBe('/overlay/programa');
  view.unmount(); window.history.pushState({}, '', '/'); jest.useRealTimers();
});
