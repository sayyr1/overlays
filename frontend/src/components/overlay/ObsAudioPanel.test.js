import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ObsAudioPanel from './ObsAudioPanel';

const state = { connected: true, sourceAvailable: true, inputName: 'BELABOX_SRT', inputs: ['BELABOX_SRT'], tournamentId: 'event', duckEnabled: true, ambientPercent: 15, volumePercent: 80, outputPercent: 80, muted: false };
test('mute and automatic ambient controls send independent changes to OBS', async () => {
  const api = jest.fn(async (url, options) => options ? { ...state, ...JSON.parse(options.body) } : state);
  render(<ObsAudioPanel tournament={{ _id: 'event' }} api={api} />);
  await screen.findByText('OBS conectado');
  fireEvent.click(screen.getByRole('button', { name: 'Silenciar campo' }));
  await screen.findByRole('button', { name: 'Activar audio del campo' });
  expect(JSON.parse(api.mock.calls.find(call => call[1]?.method === 'PATCH')[1].body)).toEqual({ muted: true });
  fireEvent.click(screen.getByRole('checkbox', { name: /Bajar ambiente/ }));
  await waitFor(() => expect(api.mock.calls.filter(call => call[1]?.method === 'PATCH')).toHaveLength(2));
  expect(JSON.parse(api.mock.calls.filter(call => call[1]?.method === 'PATCH')[1][1].body)).toEqual({ duckEnabled: false, tournamentId: 'event' });
});
test('shows the effective lowered volume and commits the slider on release', async () => {
  const api = jest.fn(async (url, options) => options ? { ...state, volumePercent: 40, outputPercent: 15, ducking: true } : { ...state, ducking: true, outputPercent: 15 });
  render(<ObsAudioPanel tournament={{ _id: 'event' }} api={api} />);
  await screen.findByText('Anuncio con audio · ambiente al 15 %');
  const slider = screen.getByRole('slider', { name: /Volumen habitual/ });
  fireEvent.change(slider, { target: { value: '40' } });
  expect(api.mock.calls.filter(call => call[1]?.method === 'PATCH')).toHaveLength(0);
  fireEvent.pointerUp(slider);
  await waitFor(() => expect(api.mock.calls.filter(call => call[1]?.method === 'PATCH')).toHaveLength(1));
  expect(JSON.parse(api.mock.calls.find(call => call[1]?.method === 'PATCH')[1].body)).toEqual({ volumePercent: 40 });
});
test('offline status disables mute and explains how to connect', async () => {
  const api = jest.fn(async () => ({ connected: false, message: 'Activa el servidor WebSocket en OBS.' }));
  render(<ObsAudioPanel tournament={{ _id: 'event' }} api={api} />);
  await screen.findByText('Activa el servidor WebSocket en OBS.');
  expect(screen.getByRole('button', { name: 'Silenciar campo' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reconectar OBS' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/obs/audio?reconnect=1'));
});

test('the remote panel reports pending commands without claiming they reached OBS', async () => {
  const api = jest.fn(async (url, options) => options ? { ...state, mode: 'bridge', pending: true, paired: true } : { ...state, mode: 'bridge', paired: true });
  render(<ObsAudioPanel tournament={{ _id: 'event' }} api={api} />);
  await screen.findByText('OBS conectado');
  fireEvent.click(screen.getByRole('button', { name: 'Silenciar campo' }));
  await screen.findByText('Orden enviada · esperando confirmación de casa…');
  expect(screen.getByRole('button', { name: 'Silenciar campo' })).toBeDisabled();
  expect(screen.queryByText('Campo silenciado manualmente')).toBeNull();
});
