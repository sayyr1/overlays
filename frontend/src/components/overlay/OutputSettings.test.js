import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OutputSettings from './OutputSettings';

test('copying the permanent link does not rotate it, while advanced replacement needs exact confirmation', async () => {
  const api = jest.fn(async () => ({ overlayUrl: '/overlay/programa?token=permanent' }));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn(async () => {}) } });
  render(<OutputSettings api={api} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copiar enlace fijo' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace fijo' }));
  await screen.findByText(/Copiarlo no cambia/);
  expect(api.mock.calls.filter(c => c[1]?.method)).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Reemplazar enlace de OBS' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Escribe REEMPLAZAR ENLACE OBS'), { target: { value: 'REEMPLAZAR ENLACE OBS' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reemplazar enlace de OBS' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/obs/output/rotate', { method: 'POST', body: JSON.stringify({ confirmation: 'REEMPLAZAR ENLACE OBS' }) }));
});
