import React from 'react';
import { render, screen } from '@testing-library/react';
import OverlayComposition from './OverlayComposition';
import { previewSnapshot } from './previewFixture';

test.each(['presentacion', 'estadisticas', 'alineacion_local', 'gol'])('el logo del evento se reutiliza en el gráfico deportivo %s', type => {
  const logo = '/logo-del-evento.png';
  const { container } = render(<OverlayComposition snapshot={{ ...previewSnapshot, tournament: { ...previewSnapshot.tournament, logo: { secureUrl: logo } }, graphics: { main: { type, data: {} } } }} />);
  expect(container.querySelector('.tv-event-mark')).toHaveAttribute('src', logo);
});
test.each(['opening', 'speaker', 'announcement'])('el logo del evento se reutiliza en la plantilla general %s', type => {
  render(<OverlayComposition snapshot={{ mode: 'general', tournament: { name: 'Mi evento', logo: { secureUrl: '/mi-logo.png' } }, graphics: { main: { type: `broadcast_${type}`, data: { title: 'Texto' } } } }} />);
  expect(screen.getByAltText('Logo de Mi evento')).toHaveAttribute('src', '/mi-logo.png');
});

test('la salida sin partido o sin auspiciantes no emite instrucciones del panel', () => {
  const { rerender, container } = render(<OverlayComposition snapshot={null} />);
  expect(container).not.toHaveTextContent('Esperando partido activo');
  rerender(<OverlayComposition snapshot={{ ...previewSnapshot, sponsors: [], graphics: { sponsorBugVisible: true } }} />);
  expect(container).not.toHaveTextContent('Configura auspiciantes');
  expect(container.querySelector('.tv-sponsor-ribbon')).toBeNull();
});

test.each(['presentacion', 'descanso', 'resultado_final', 'estadisticas', 'alineacion_local'])('la placa %s muestra los datos del partido', (type) => {
  const { container } = render(<OverlayComposition preview snapshot={{ ...previewSnapshot, graphics: { main: { id: 'demo', type } } }} />);
  expect(container).toHaveTextContent('Deportivo del Norte');
});

test('el marcador usa tiempo real y los eventos conviven con un rótulo', () => {
  const { container } = render(<OverlayComposition preview snapshot={{ ...previewSnapshot, graphics: {
    ...previewSnapshot.graphics, sponsorBugVisible: true,
    temporary: { id: 'goal', type: 'gol', data: { playerName: 'A. Valencia' } },
    lowerThird: { id: 'name', type: 'narradores', data: { name: 'Equipo de transmisión' } },
  } }} />);
  expect(screen.getByText('67:12')).toBeInTheDocument();
  expect(screen.getByText('2T')).toBeInTheDocument();
  expect(screen.getByText('A. Valencia')).toBeInTheDocument();
  expect(screen.getByText('Equipo de transmisión')).toBeInTheDocument();
  expect(container.querySelector('.tv-with-sponsor')).not.toBeNull();
});

test('la publicidad ocupa la franja inferior y conserva marcador y reloj', () => {
  const { container } = render(<OverlayComposition preview snapshot={{ ...previewSnapshot, sponsorDeck: { logos: { id: 'logo', startedAt: new Date().toISOString(), duration: 10, items: [{ name: 'Marca de prueba', kind: 'logo', secureUrl: '/logo.png', duration: 10 }] } }, graphics: { ...previewSnapshot.graphics, scoreboardVisible: true, clockVisible: true, lowerThird: { id: 'lower', type: 'narradores', data: { name: 'Narrador' } } } }} />);
  expect(container.querySelector('.tv-ad-active')).not.toBeNull();
  expect(container.querySelector('.tv-ad-logo')).toHaveTextContent('Marca de prueba');
  expect(container.querySelector('.tv-scorebug')).not.toBeNull();
  expect(container.querySelector('.tv-clock')).not.toBeNull();
});
