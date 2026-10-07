import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReplayBranding from './ReplayBranding';

test('a library animation defaults to intro and saves event settings without a duplicate label', async () => {
  const api = jest.fn(async url => url === '/media' ? [{ _id: 'video', name: 'Entrada.mp4', kind: 'video', format: 'mp4', secureUrl: 'https://example.com/intro.mp4', duration: 2 }] : { asset: null, placement: 'corner', showLabel: true });
  render(<ReplayBranding tournament={{ _id: 'event' }} api={api} />);
  await screen.findByRole('option', { name: 'Entrada.mp4' });
  fireEvent.change(screen.getByLabelText('O reutilizar de la biblioteca'), { target: { value: 'video' } });
  expect(screen.getByLabelText('Cómo mostrarlo')).toHaveValue('intro');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/tournaments/event/replay-branding', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ assetId: 'video', placement: 'intro', showLabel: false }) })));
  await screen.findByText(/Se aplicará automáticamente/);
});

test('a long intro cannot be saved', async () => {
  const api = jest.fn(async url => url === '/media' ? [{ _id: 'video', name: 'Larga.mp4', kind: 'video', format: 'mp4', duration: 20 }] : { asset: null });
  render(<ReplayBranding tournament={{ _id: 'event' }} api={api} />);
  await screen.findByRole('option', { name: 'Larga.mp4' });
  fireEvent.change(screen.getByLabelText('O reutilizar de la biblioteca'), { target: { value: 'video' } });
  expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled();
});
