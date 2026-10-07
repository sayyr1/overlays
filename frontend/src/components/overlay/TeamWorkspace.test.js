import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeamLibrary, EventTeams } from './TeamWorkspace';
import { teamCrest } from './TeamBadge';
test('teams are created independently with an optional logo', async () => {
  const api = jest.fn(async () => []);
  render(<TeamLibrary api={api} apiBase="" />);
  fireEvent.click(screen.getByRole('button', { name: '+ Nuevo equipo' }));
  fireEvent.change(screen.getByLabelText('Nombre del equipo'), { target: { value: 'San Juan' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/teams', expect.objectContaining({ method: 'POST' })));
  const values = JSON.parse(api.mock.calls.find(call => call[1]?.method === 'POST')[1].body);
  expect(values.name).toBe('San Juan'); expect(values.tournament).toBeUndefined();
});
test('assigned teams are shown and new selection is saved only to the event', async () => {
  const assigned = { _id: 'one', name: 'San Juan', code: 'SJU' }, available = { _id: 'two', name: 'River', code: 'RIV' };
  const api = jest.fn(async () => [assigned, available]);
  render(<EventTeams tournament={{ _id: 'event', name: 'Copa' }} teams={[assigned]} api={api} onSaved={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Asignados (1)' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Agregar seleccionados (1)' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/tournaments/event/teams', { method: 'POST', body: JSON.stringify({ teamIds: ['two'] }) }));
});
test('automatic crests escape text and uploaded logos retain their URL', () => {
  expect(decodeURIComponent(teamCrest({ code: '<&>' }))).toContain('&lt;&amp;&gt;');
  expect(teamCrest({ crest: { secureUrl: 'https://example.com/logo.png' } })).toBe('https://example.com/logo.png');
});
