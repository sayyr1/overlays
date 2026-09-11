import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BroadcastControls, BroadcastEditor } from './BroadcastStudio';
import OverlayComposition from './OverlayComposition';

const scene = { id: 'start', type: 'opening', label: 'Inicio', title: 'Mi presentación', subtitle: 'Bienvenidos', duration: 0, seconds: 300 };
const snapshot = { mode: 'presentation', tournament: { name: 'Mi evento' }, broadcast: { scenes: [scene] }, graphics: {}, match: null };

test('emite una plantilla sin partido y permite retirarla', () => {
  const send = jest.fn();
  const { rerender } = render(<BroadcastControls snapshot={snapshot} send={send} />);
  fireEvent.click(screen.getByRole('button', { name: /Inicio Mi presentación/ }));
  expect(send).toHaveBeenCalledWith('take', { sceneId: 'start' });
  rerender(<BroadcastControls snapshot={{ ...snapshot, graphics: { main: { type: 'broadcast_opening', data: { sceneId: 'start' } } } }} send={send} />);
  fireEvent.click(screen.getByRole('button', { name: /EN AIRE/ }));
  expect(send).toHaveBeenCalledWith('hide', { layer: 'main' });
});

test('el editor guarda los textos y la duplicación reutiliza la biblioteca', async () => {
  const api = jest.fn().mockResolvedValue({ tournament: { _id: 'copy' } });
  const onCreated = jest.fn();
  render(<BroadcastEditor tournament={{ _id: 'event', mode: 'presentation', broadcast: { scenes: [scene] } }} api={api} onSaved={jest.fn()} onCreated={onCreated} />);
  fireEvent.change(screen.getByLabelText('Texto principal'), { target: { value: 'Nuevo título' } });
  expect(screen.getByRole('button', { name: 'Duplicar preparación' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText(/Biblioteca guardada/);
  expect(JSON.parse(api.mock.calls[0][1].body).scenes[0].title).toBe('Nuevo título');
  fireEvent.change(screen.getByLabelText('Nombre de la nueva transmisión'), { target: { value: 'Siguiente evento' } });
  fireEvent.click(screen.getByRole('button', { name: 'Duplicar preparación' }));
  await waitFor(() => expect(onCreated).toHaveBeenCalled());
  expect(JSON.parse(api.mock.calls[1][1].body)).toMatchObject({ mode: 'presentation', name: 'Siguiente evento', broadcast: { scenes: [{ ...scene, title: 'Nuevo título' }] } });
});

test('la salida general funciona sin partido y descarta gráficos caducados', () => {
  const { rerender } = render(<OverlayComposition snapshot={{ ...snapshot, graphics: { main: { id: 'one', type: 'broadcast_opening', data: { title: 'Bienvenidos' } } } }} />);
  expect(screen.getByText('Bienvenidos')).toBeInTheDocument();
  rerender(<OverlayComposition snapshot={{ ...snapshot, graphics: { main: { id: 'one', type: 'broadcast_opening', data: { title: 'Bienvenidos' }, expiresAt: '2000-01-01' } } }} />);
  expect(screen.queryByText('Bienvenidos')).not.toBeInTheDocument();
});

test('la cuenta regresiva recupera el tiempo transcurrido al abrir OBS', () => {
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-11T12:01:00Z').getTime());
  render(<OverlayComposition snapshot={{ ...snapshot, graphics: { main: { id: 'timer', type: 'broadcast_countdown', activatedAt: '2026-09-11T12:00:00Z', data: { title: 'Enseguida', seconds: 300 } } } }} />);
  expect(screen.getByText('04:00')).toBeInTheDocument();
  jest.restoreAllMocks();
});
