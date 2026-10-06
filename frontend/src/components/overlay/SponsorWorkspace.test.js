import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SponsorLibrary, EventSponsors } from './SponsorWorkspace';

test('brands are created independently without event participation settings', async () => {
  const api = jest.fn(async () => []);
  render(<SponsorLibrary api={api} apiBase="" onSaved={jest.fn()} />);
  await screen.findByText('Tu biblioteca empieza aquí');
  fireEvent.click(screen.getByRole('button', { name: '+ Nuevo auspiciante' }));
  expect(screen.queryByLabelText('Confirmado')).toBeNull();
  expect(screen.queryByLabelText('Orden')).toBeNull();
  fireEvent.change(screen.getByLabelText('Nombre comercial'), { target: { value: 'Marca nueva' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar auspiciante' }));
  await waitFor(() => expect(screen.getByText('Marca guardada en tu biblioteca.')).toBeInTheDocument());
  const payload = JSON.parse(api.mock.calls.find(([path, options]) => path === '/sponsors' && options?.method === 'POST')[1].body);
  expect(payload).toMatchObject({ name: 'Marca nueva', videoMuted: false });
  expect(payload).not.toHaveProperty('tournament');
  expect(payload).not.toHaveProperty('confirmed');
});

test('multiple library brands are assigned from event configuration', async () => {
  const api = jest.fn(async path => path === '/sponsors' ? [{ _id: 'a', name: 'Marca A' }, { _id: 'b', name: 'Marca B' }] : []);
  const onSaved = jest.fn();
  render(<EventSponsors tournament={{ _id: 'event', name: 'Festival' }} sponsors={[]} api={api} onSaved={onSaved} />);
  await screen.findByText('Marca A');
  fireEvent.click(screen.getByLabelText(/Marca A/));
  fireEvent.click(screen.getByLabelText(/Marca B/));
  fireEvent.click(screen.getByRole('button', { name: 'Agregar seleccionados (2)' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const call = api.mock.calls.find(([path]) => path === '/tournaments/event/sponsors');
  expect(JSON.parse(call[1].body)).toEqual({ sponsorIds: ['a', 'b'] });
});

test('event participation cannot overwrite shared brand data', async () => {
  const api = jest.fn(async () => []);
  render(<EventSponsors tournament={{ _id: 'event', name: 'Festival' }} sponsors={[{ _id: 'a', name: 'Marca A', active: true, confirmed: false, durationSeconds: 10 }]} api={api} onSaved={jest.fn()} />);
  fireEvent.click(screen.getByLabelText('Confirmado'));
  fireEvent.change(screen.getByLabelText('Duración (s)'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar participación' }));
  await waitFor(() => expect(api.mock.calls.some(([path]) => path === '/tournaments/event/sponsors/a')).toBe(true));
  const payload = JSON.parse(api.mock.calls.find(([path]) => path === '/tournaments/event/sponsors/a')[1].body);
  expect(payload).toEqual({ confirmed: true, active: true, order: 0, durationSeconds: 20 });
});

test('switching between assigned brands and selection preserves checked brands', async () => {
  const api = jest.fn(async path => path === '/sponsors' ? [{ _id: 'b', name: 'Marca B' }] : []);
  render(<EventSponsors tournament={{ _id: 'event', name: 'Festival' }} sponsors={[{ _id: 'a', name: 'Marca A', active: true, confirmed: true }]} api={api} onSaved={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Asignados (1)' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Agregar marcas' }));
  fireEvent.click(await screen.findByLabelText(/Marca B/));
  fireEvent.click(screen.getByRole('button', { name: 'Asignados (1)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Agregar marcas' }));
  expect(screen.getByLabelText(/Marca B/)).toBeChecked();
  expect(screen.getByText('1 marca seleccionada')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Agregar seleccionados (1)' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Asignados (1)' })).toHaveAttribute('aria-pressed', 'true'));
});
