import React from 'react';
import { render, screen } from '@testing-library/react';
import OverlayComposition from './OverlayComposition';
import { previewSnapshot } from './previewFixture';

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
