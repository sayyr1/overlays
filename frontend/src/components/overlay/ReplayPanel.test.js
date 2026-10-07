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
  expect(screen.getAllByRole('button', { name: 'Reproducir Última jugada' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar jugada' }));
  await waitFor(() => expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(1));
  expect(JSON.parse(api.mock.calls.find(c => c[1]?.method)[1].body)).toEqual({ action: 'save', tournamentId: 'event' });
  fireEvent.click(screen.getByRole('button', { name: 'Reproducir Última jugada' }));
  await screen.findByText('REPETICIÓN EN AIRE');
  expect(screen.getByRole('button', { name: 'Guardar jugada' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Volver al directo' }));
  await waitFor(() => expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(3));
});

test('clip menu renames a scoped clip and requires a second action to delete it', async () => {
  const status = { connected: true, replay: { bufferAvailable: true, bufferActive: true, clips: [{ id: 'clip', name: 'Gol 24', tournamentId: 'event', savedAt: new Date().toISOString() }] } };
  const api = jest.fn(async () => status);
  render(<ReplayPanel tournament={{ _id: 'event' }} api={api} />);
  await screen.findByText('Gol 24');
  fireEvent.click(screen.getByRole('button', { name: 'Opciones de Gol 24' }));
  fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
  fireEvent.change(screen.getByLabelText('Nombre de la jugada'), { target: { value: '  Penal atajado  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
  await waitFor(() => expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(1));
  expect(JSON.parse(api.mock.calls.find(c => c[1]?.method)[1].body)).toEqual({ action: 'rename', tournamentId: 'event', clipId: 'clip', name: 'Penal atajado' });
  await waitFor(() => expect(screen.queryByLabelText('Nombre de la jugada')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Opciones de Gol 24' }));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
  expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(1);
  expect(screen.getByText(/El archivo original se conserva/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
  await waitFor(() => expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(2));
  expect(JSON.parse(api.mock.calls.filter(c => c[1]?.method)[1][1].body)).toEqual({ action: 'delete', tournamentId: 'event', clipId: 'clip' });
});

test('the deck pages clips and the latest shortcut always sends the newest registered clip', async () => {
  const status = { connected: true, replay: { bufferAvailable: true, bufferActive: true, clips: Array.from({ length: 8 }, (_, i) => ({ id: `clip${i}`, name: `Clip ${i}`, tournamentId: 'event', savedAt: new Date().toISOString() })) } };
  const api = jest.fn(async () => status);
  render(<ReplayPanel tournament={{ _id: 'event' }} api={api} />);
  await screen.findByText('Clip 0');
  expect(screen.queryByText('Clip 6')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Anteriores →' }));
  expect(screen.getByText('Clip 6')).toBeInTheDocument();
  expect(screen.queryByText('Clip 0')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reproducir última' }));
  await waitFor(() => expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(1));
  expect(JSON.parse(api.mock.calls.find(c => c[1]?.method)[1].body)).toEqual({ action: 'play', tournamentId: 'event', clipId: 'clip0' });
});
