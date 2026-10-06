import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SponsorDeck from './SponsorDeck';
test('the deck exposes logo rotation, one commercial break, and manual selection', async () => {
  const api = jest.fn(async () => ({ snapshot: { revision: 2 } }));
  const onSnapshot = jest.fn();
  render(<SponsorDeck tournament={{ _id: 'event' }} sponsors={[{ _id: 'brand', name: 'Marca', confirmed: true, active: true, logo: { secureUrl: '/logo.png' }, mediaVideo: 'video', videoMuted: false }, { _id: 'pending', name: 'Pendiente', confirmed: false }]} snapshot={{}} api={api} onSnapshot={onSnapshot} />);
  expect(screen.queryByText('Pendiente')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Rotar logos · sin audio' }));
  await waitFor(() => expect(onSnapshot).toHaveBeenCalled());
  expect(JSON.parse(api.mock.calls[0][1].body)).toEqual({ action: 'logos' });
  fireEvent.click(screen.getByRole('button', { name: 'Reproducir anuncio' }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(JSON.parse(api.mock.calls[1][1].body)).toEqual({ action: 'manual_video', sponsorId: 'brand' });
});
