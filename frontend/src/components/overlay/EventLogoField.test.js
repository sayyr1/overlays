import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventLogoField, { uploadEventLogo } from './EventLogoField';

afterEach(() => jest.restoreAllMocks());
test('upload uses the authenticated image endpoint and returns reusable metadata', async () => {
  const logo = { publicId: 'eventos/logo', secureUrl: 'https://res.cloudinary.com/demo/image/upload/logo.png' };
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => logo }));
  const file = new File(['logo'], 'logo.png', { type: 'image/png' });
  expect(await uploadEventLogo(file, '')).toEqual(logo);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe('/api/sports/upload'); expect(options.credentials).toBe('include');
  expect(options.body.get('file')).toBe(file); expect(options.body.get('folder')).toBe('eventos');
});
test('invalid files and provider failures cannot silently discard the logo', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ message: 'No se pudo subir el logo' }) }));
  await expect(uploadEventLogo(new File(['x'], 'video.mp4', { type: 'video/mp4' }), '')).rejects.toThrow('PNG');
  expect(fetch).not.toHaveBeenCalled();
  await expect(uploadEventLogo(new File(['x'], 'logo.png', { type: 'image/png' }), '')).rejects.toThrow('No se pudo subir el logo');
});
test('logo selection previews the asset and removing it keeps the other form fields', async () => {
  render(<form><input name="name" defaultValue="Copa" /><EventLogoField /></form>);
  const input = screen.getByLabelText('Logo del evento (opcional)');
  fireEvent.change(input, { target: { files: [new File(['logo'], 'logo.png', { type: 'image/png' })] } });
  expect(await screen.findByAltText('Vista previa del logo del evento')).toHaveAttribute('src', expect.stringContaining('data:image/png'));
  fireEvent.click(screen.getByRole('button', { name: 'Quitar logo' }));
  await waitFor(() => expect(screen.queryByAltText('Vista previa del logo del evento')).not.toBeInTheDocument());
  expect(screen.getByDisplayValue('Copa')).toBeInTheDocument();
});
