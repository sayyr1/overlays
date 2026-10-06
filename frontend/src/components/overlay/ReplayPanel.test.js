import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReplayPanel from './ReplayPanel';

test('a legacy server response explains missing replay support without claiming OBS buffer is stopped', async () => {
  const api = jest.fn(async () => ({ connected: true, mode: 'bridge' }));
  render(<ReplayPanel tournament={{ _id: 'event' }} api={api} />);
  await screen.findByText('Estado no disponible');
  expect(screen.getByText(/El servidor o el puente de casa necesita actualizarse/)).toBeInTheDocument();
  expect(screen.queryByText(/Habilita el búfer/)).not.toBeInTheDocument();
  expect(screen.queryByText('Búfer detenido')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Guardar jugada' })).toBeDisabled();
});

test('saving and playing use the event and registered clip, with separate return-to-live control', async () => {
  const status = { connected: true, replay: { bufferAvailable: true, bufferActive: true, clips: [{ id: 'clip', tournamentId: 'event', savedAt: new Date().toISOString() }, { id: 'other', tournamentId: 'other', savedAt: new Date().toISOString() }] } };
  const api = jest.fn(async (url, options) => options ? { ...status, replay: { ...status.replay, playingClipId: JSON.parse(options.body).action === 'play' ? 'clip' : null } } : status);
  render(<ReplayPanel tournament={{ _id: 'event' }} api={api} />);
  await screen.findByText('Última jugada');
  expect(screen.getAllByRole('button', { name: 'Reproducir' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar jugada' }));
  await waitFor(() => expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(1));
  expect(JSON.parse(api.mock.calls.find(c => c[1]?.method)[1].body)).toEqual({ action: 'save', tournamentId: 'event' });
  fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }));
  await screen.findByText('REPETICIÓN EN AIRE');
  expect(screen.getByRole('button', { name: 'Guardar jugada' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Volver al directo' }));
  await waitFor(() => expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(3));
});
