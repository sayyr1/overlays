import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  global.fetch = jest.fn(async (url) => {
    let data = [];
    if (url.endsWith('/auth/me')) data = { admin: { name: 'Operador' } };
    if (url.endsWith('/tournaments')) data = [{ _id: 'cup', name: 'Copa de prueba' }];
    if (url.endsWith('/overlay-state')) data = { revision: 1, graphics: {}, generatedAt: '2026-09-11T12:00:00Z' };
    return { ok: true, status: 200, json: async () => data };
  });
});
afterEach(() => { jest.restoreAllMocks(); });

test('el menú permite acceder a torneo, enlaces y cierre de sesión', async () => {
  render(<App />);
  const more = await screen.findByRole('button', { name: 'Más' });
  expect(more).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(more);
  expect(screen.getByLabelText('Torneo activo')).toHaveValue('cup');
  expect(screen.getByRole('region', { name: 'Torneo y sesión' })).toHaveTextContent('Regenerar un enlace invalida el anterior');
  fireEvent.click(more);
  expect(screen.queryByLabelText('Torneo activo')).not.toBeInTheDocument();
});

test('un fallo de conexión se comunica sin afirmar que está sincronizado', async () => {
  const original = global.fetch;
  global.fetch = jest.fn((url) => url.endsWith('/health') ? Promise.reject(new Error('offline')) : original(url));
  render(<App />);
  await waitFor(() => expect(screen.getByText('Sin conexión')).toBeInTheDocument());
  expect(screen.queryByText(/Sincronizado/)).not.toBeInTheDocument();
});
