import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from './App';
import * as eventLogo from './components/overlay/EventLogoField';

test('el logo subido se guarda en el evento nuevo y puede usarse en sus overlays', async () => {
  const logo = { publicId: 'eventos/copa', secureUrl: 'https://res.cloudinary.com/demo/image/upload/copa.png' };
  jest.spyOn(eventLogo, 'uploadEventLogo').mockResolvedValue(logo);
  const original = global.fetch;
  global.fetch = jest.fn(async (url, options) => url.endsWith('/tournaments') && options?.method === 'POST' ? { ok: true, status: 201, json: async () => ({ tournament: { _id: 'new', name: 'Copa nueva' }, overlayUrl: '/overlay/programa?token=test' }) } : original(url, options));
  render(<App />);
  const name = await screen.findByLabelText('Nombre de la transmisión');
  fireEvent.change(name, { target: { value: 'Copa nueva' } });
  fireEvent.submit(name.closest('form'));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url, options]) => url.endsWith('/tournaments') && options?.method === 'POST')).toBe(true));
  const request = global.fetch.mock.calls.find(([url, options]) => url.endsWith('/tournaments') && options?.method === 'POST');
  expect(JSON.parse(request[1].body)).toMatchObject({ name: 'Copa nueva', logo });
});

test('si falla la carga del logo, conserva el formulario y permite reintentar sin crear el evento', async () => {
  jest.spyOn(eventLogo, 'uploadEventLogo').mockRejectedValue(new Error('No se pudo subir el logo'));
  render(<App />);
  const name = await screen.findByLabelText('Nombre de la transmisión');
  fireEvent.change(name, { target: { value: 'Mi campeonato' } });
  fireEvent.submit(name.closest('form'));
  expect(await screen.findByText('No se pudo subir el logo')).toBeInTheDocument();
  expect(name).toHaveValue('Mi campeonato');
  expect(global.fetch.mock.calls.some(([url, options]) => url.endsWith('/tournaments') && options?.method === 'POST')).toBe(false);
  expect(within(name.closest('form')).getByRole('button', { name: 'Guardar' })).toBeEnabled();
});

beforeEach(() => {
  window.scrollTo = jest.fn();
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

test('el control deportivo no monta monitores y permite comprobar gráficos solo a pedido', async () => {
  const { container } = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Control en vivo' }));
  expect(container.querySelector('.preview-panel')).toBeNull();
  expect(container.querySelector('.preview-frame')).toBeNull();
  expect(screen.getByRole('region', { name: 'Control de publicidad' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Más' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ver salida de OBS' }));
  const dialog = screen.getByRole('dialog', { name: 'Gráficos de OBS · 1920 × 1080' });
  expect(dialog).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(global.fetch.mock.calls.some(([, options]) => options?.method && options.method !== 'GET')).toBe(false);
});

test('el control de eventos generales también elimina la vista previa permanente', async () => {
  const original = global.fetch;
  global.fetch = jest.fn(async (url, options) => {
    if (url.endsWith('/tournaments')) return { ok: true, status: 200, json: async () => [{ _id: 'cup', name: 'Evento de prueba', mode: 'general' }] };
    if (url.endsWith('/overlay-state')) return { ok: true, status: 200, json: async () => ({ mode: 'general', graphics: {}, broadcast: { scenes: [] } }) };
    return original(url, options);
  });
  const { container } = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Control en vivo' }));
  expect(container.querySelector('.preview-panel')).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Salida de la transmisión' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Control de publicidad' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Salida OBS/ }));
  expect(screen.getByRole('dialog', { name: 'Gráficos de OBS · 1920 × 1080' })).toBeInTheDocument();
});

test('el control móvil cambia de pantalla sin perder el evento activo', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Control en vivo' }));
  expect(within(screen.getByRole('navigation', { name: 'Pantallas de control en vivo' })).getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Partido' }));
  expect(screen.getByRole('button', { name: 'Partido' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Publicidad' }));
  expect(screen.getByRole('button', { name: 'Publicidad' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('region', { name: 'Control de publicidad' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
  expect(screen.getByRole('button', { name: 'Audio' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: 'Copa de prueba' })).toBeInTheDocument();
});

test('media se prepara en configuración y no ocupa el control en vivo', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Control en vivo' }));
  expect(screen.getByRole('region', { name: 'Control de publicidad' })).toBeInTheDocument();
  expect(screen.queryByText(/Media y motion graphics/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Configurar evento' }));
  fireEvent.click(screen.getByRole('button', { name: 'Archivos y capas' }));
  expect(await screen.findByText(/Media y motion graphics/)).toBeInTheDocument();
  expect(screen.getByText(/Media y motion graphics/).parentElement).toHaveAttribute('open');
  expect(screen.queryByRole('region', { name: 'Control de publicidad' })).not.toBeInTheDocument();
});

test('el evento se elimina con confirmación visible y desaparece del listado', async () => {
  let deleted = false;
  const original = global.fetch;
  global.fetch = jest.fn(async (url, options) => {
    if (url.endsWith('/tournaments/cup') && options?.method === 'DELETE') { deleted = true; return { ok: true, status: 204 }; }
    if (url.endsWith('/tournaments') && deleted) return { ok: true, status: 200, json: async () => [] };
    return original(url, options);
  });
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Configurar evento' }));
  fireEvent.click(screen.getByText('Eliminar este evento'));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar Copa de prueba' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Eliminar definitivamente' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Escribe el nombre del evento para confirmar'), { target: { value: 'Copa de prueba' } });
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
  expect(await screen.findByText('Evento eliminado.')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Copa de prueba' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('los errores de eliminación permanecen visibles y permiten reintentar', async () => {
  const original = global.fetch;
  global.fetch = jest.fn((url, options) => url.endsWith('/tournaments/cup') && options?.method === 'DELETE' ? Promise.resolve({ ok: false, status: 500, json: async () => ({ message: 'No se pudo eliminar el evento' }) }) : original(url, options));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Configurar evento' }));
  fireEvent.click(screen.getByText('Eliminar este evento'));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar Copa de prueba' }));
  fireEvent.change(screen.getByLabelText('Escribe el nombre del evento para confirmar'), { target: { value: 'Copa de prueba' } });
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo eliminar el evento');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Eliminar definitivamente' })).toBeEnabled();
});

test('un backend sin la ruta de eliminación informa el problema en lugar de un error genérico', async () => {
  const original = global.fetch;
  global.fetch = jest.fn((url, options) => url.endsWith('/tournaments/cup') && options?.method === 'DELETE' ? Promise.resolve({ ok: false, status: 404, json: async () => { throw new Error('Respuesta HTML'); } }) : original(url, options));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Configurar evento' }));
  fireEvent.click(screen.getByText('Eliminar este evento'));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar Copa de prueba' }));
  fireEvent.change(screen.getByLabelText('Escribe el nombre del evento para confirmar'), { target: { value: 'Copa de prueba' } });
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
  const error = await screen.findByRole('alert');
  expect(error).toHaveTextContent('El servidor no reconoce la ruta para eliminar eventos');
  expect(error).toHaveTextContent('HTTP 404');
});

test('la biblioteca de auspiciantes funciona sin tener eventos creados', async () => {
  const original = global.fetch;
  global.fetch = jest.fn(url => url.endsWith('/tournaments') ? Promise.resolve({ ok: true, status: 200, json: async () => [] }) : original(url));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Auspiciantes' }));
  expect(await screen.findByText('Tu biblioteca empieza aquí')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ Nuevo auspiciante' }));
  expect(screen.getByLabelText('Nombre comercial')).toBeInTheDocument();
  expect(screen.queryByText(/Confirmado en/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Media y motion graphics/)).not.toBeInTheDocument();
});

test('la selección de auspiciantes pertenece a la configuración del evento', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Configurar evento' }));
  expect(await screen.findByText('Auspiciantes de Copa de prueba')).toBeInTheDocument();
  expect(screen.getByText('Elegir de la biblioteca')).toBeInTheDocument();
  expect(screen.queryByText('Crear auspiciante')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Administrar biblioteca' }));
  expect(await screen.findByText('Tus marcas, siempre disponibles')).toBeInTheDocument();
  expect(screen.queryByText('Auspiciantes de Copa de prueba')).not.toBeInTheDocument();
});

test('el menú permite acceder a torneo, enlaces y cierre de sesión', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Control en vivo' }));
  const more = await screen.findByRole('button', { name: 'Más' });
  expect(more).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(more);
  expect(screen.getByLabelText('Torneo activo')).toHaveValue('cup');
  expect(screen.getByRole('region', { name: 'Torneo y sesión' })).toHaveTextContent('Copiar el enlace de OBS mantiene la misma dirección');
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
