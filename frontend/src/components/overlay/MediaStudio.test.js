import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MediaStudio from './MediaStudio';

const asset = { _id: 'asset', name: 'Frame invitado', category: 'motion', kind: 'video', format: 'webm', width: 1920, height: 1080 };
function setup(extra = {}) {
  const api = jest.fn(async (path, options) => {
    if (path === '/media') return [asset];
    if (path === '/media-presets') return [];
    if (path.endsWith('/control')) return { snapshot: { revision: 2 } };
    return {};
  });
  const onSnapshot = jest.fn();
  render(<MediaStudio tournament={{ _id: 'event' }} snapshot={{}} api={api} onSnapshot={onSnapshot} onSaved={jest.fn()} {...extra} />);
  fireEvent.click(screen.getByText(/Media y motion graphics/));
  return { api, onSnapshot };
}
test('library selection and live take send layout to the selected tournament', async () => {
  const { api, onSnapshot } = setup();
  fireEvent.click(await screen.findByRole('button', { name: /Frame invitado/ }));
  fireEvent.change(screen.getByLabelText('Posición X'), { target: { value: '96' } });
  fireEvent.change(screen.getByLabelText('Duración (0 = manual)'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /Mostrar \/ PLAY/ }));
  await waitFor(() => expect(onSnapshot).toHaveBeenCalledWith({ revision: 2 }));
  const call = api.mock.calls.find(([path]) => path.endsWith('/control'));
  expect(call[0]).toBe('/tournaments/event/media/control');
  expect(JSON.parse(call[1].body)).toMatchObject({ action: 'take', slot: '0', assetId: 'asset', config: { x: 96, duration: 10 } });
});
test('existing sponsor logos can be emitted without uploading again', async () => {
  const { api } = setup({ sponsors: [{ _id: 'sponsor', name: 'Marca', logo: { secureUrl: 'https://example.com/logo.png' } }] });
  await screen.findByRole('button', { name: /Frame invitado/ });
  fireEvent.change(screen.getByLabelText('Auspiciante'), { target: { value: 'sponsor' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar LOGO' }));
  await waitFor(() => expect(api.mock.calls.some(([path]) => path.endsWith('/control'))).toBe(true));
  const call = api.mock.calls.find(([path]) => path.endsWith('/control'));
  expect(JSON.parse(call[1].body)).toMatchObject({ action: 'take', slot: '15', sponsorId: 'sponsor', variant: 'mediaLogo', config: { duration: 10 } });
});

test('sponsor video emits with audio and pending sponsors cannot be selected', async () => {
 const { api } = setup({ sponsors: [{ _id: 'sponsor', name: 'Marca', mediaVideo: 'asset', confirmed: true, videoMuted: false }, { _id: 'pending', name: 'Pendiente', confirmed: false }] });
 await screen.findByRole('button', { name: /Frame invitado/ });
 expect(screen.queryByRole('option', { name: 'Pendiente' })).toBeNull();
 fireEvent.change(screen.getByLabelText('Auspiciante'), { target: { value: 'sponsor' } });
 fireEvent.click(screen.getByRole('button', { name: 'Mostrar VIDEO' }));
 await waitFor(() => expect(api.mock.calls.some(([path]) => path.endsWith('/control'))).toBe(true));
 const call = api.mock.calls.find(([path]) => path.endsWith('/control'));
 expect(JSON.parse(call[1].body)).toMatchObject({ variant: 'mediaVideo', config: { muted: false } });
});
