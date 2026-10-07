import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LiveConsole from './LiveConsole';

beforeEach(() => localStorage.clear());
const tournament = { _id: 'event', name: 'Evento en edición', mode: 'event' };
const output = { tournament: { id: 'other', name: 'Evento en aire' }, connected: true, applied: true, stateConfirmed: true, seenStateRevision: 5 };
const obs = { connected: true, sourceAvailable: true, muted: false, replay: { bufferActive: true } };

test('browsing an event never switches OBS; replacing an on-air event requires explicit confirmation', async () => {
  const api = jest.fn(async (url, options) => url === '/obs/audio' ? obs : options ? { ...output, tournament: { id: 'event', name: tournament.name } } : output);
  render(<LiveConsole tournament={tournament} api={api} onNavigate={jest.fn()} onSnapshot={jest.fn()} />);
  await screen.findByText('Evento en aire');
  expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Enviar este evento a OBS' }));
  expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de evento' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/obs/output/event', { method: 'PUT', body: JSON.stringify({ tournamentId: 'event' }) }));
});

test('favorite mute queues only the audio command and favorite choices persist on the device', async () => {
  const api = jest.fn(async url => url === '/obs/audio' ? obs : { ...output, tournament: { id: 'event', name: tournament.name } });
  const view = render(<LiveConsole tournament={tournament} api={api} onNavigate={jest.fn()} onSnapshot={jest.fn()} />);
  const mute = screen.getByRole('button', { name: /Silenciar campo/ });
  await waitFor(() => expect(mute).toBeEnabled());
  fireEvent.click(mute);
  await waitFor(() => expect(api).toHaveBeenCalledWith('/obs/audio', { method: 'PATCH', body: JSON.stringify({ muted: true }) }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar teclas' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Guardar jugada' }));
  expect(JSON.parse(localStorage.getItem('overlay-favorites:event'))).not.toContain('replay_save');
  view.unmount();
  render(<LiveConsole tournament={tournament} api={api} onNavigate={jest.fn()} onSnapshot={jest.fn()} />);
  expect(screen.queryByRole('button', { name: /Guardar jugada/ })).not.toBeInTheDocument();
});
