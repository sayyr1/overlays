import React from 'react';
import { render, screen } from '@testing-library/react';
import OverlayComposition, { graphicTeam, statShare } from './OverlayComposition';
import { previewSnapshot } from './previewFixture';

test('el paquete deportivo conserva los colores del evento y distingue ambos equipos', () => {
  const { container, rerender } = render(<OverlayComposition snapshot={previewSnapshot} />);
  const root = container.querySelector('.tv-overlay-root');
  expect(root).toHaveClass('tv-sports');
  expect(root.style.getPropertyValue('--primary')).toBe(previewSnapshot.tournament.colors.primary);
  const teams = container.querySelectorAll('.tv-team-side');
  expect(teams[0].style.getPropertyValue('--team-color')).toBe(previewSnapshot.match.homeTeam.primaryColor);
  expect(teams[1].style.getPropertyValue('--team-color')).toBe(previewSnapshot.match.awayTeam.primaryColor);
  rerender(<OverlayComposition snapshot={{ mode: 'general', tournament: {}, graphics: {} }} />);
  expect(container.querySelector('.tv-overlay-root')).not.toHaveClass('tv-sports');
});
test('las barras de estadísticas corresponden a los valores del partido y son neutrales sin datos', () => {
  expect(statShare(58, 42)).toBe(58);
  expect(statShare(12, 8)).toBe(60);
  expect(statShare(0, 0)).toBe(50);
  expect(statShare(undefined, undefined)).toBe(50);
  expect(statShare(-1, 10)).toBe(0);
  expect(statShare(Infinity, 10)).toBe(0);
  const { container } = render(<OverlayComposition snapshot={{ ...previewSnapshot, graphics: { main: { type: 'estadisticas' } } }} />);
  expect(container.querySelector('.tv-stat-board p').style.getPropertyValue('--home-share')).toBe('58%');
});

const football = {
  ...previewSnapshot,
  tournament: { ...previewSnapshot.tournament, logo: { secureUrl: '/campeonato.png' } },
  match: { ...previewSnapshot.match,
    homeTeam: { ...previewSnapshot.match.homeTeam, crest: { secureUrl: '/local.png' } },
    awayTeam: { ...previewSnapshot.match.awayTeam, crest: { secureUrl: '/visitante.png' } },
  },
};
test.each(['alineacion_local', 'formacion_local', 'alineacion_visitante', 'formacion_visitante'])('la plantilla %s utiliza el escudo de su equipo y el logo del campeonato', type => {
  const home = type.endsWith('local');
  const { container } = render(<OverlayComposition snapshot={{ ...football, graphics: { main: { type } } }} />);
  expect(container.querySelector('.tv-lineup-identity img')).toHaveAttribute('src', home ? '/local.png' : '/visitante.png');
  expect(container.querySelector('.tv-event-mark')).toHaveAttribute('src', '/campeonato.png');
});
test.each(['estadisticas', 'tabla_vivo'])('la plantilla %s reutiliza ambos escudos', type => {
  const { container } = render(<OverlayComposition snapshot={{ ...football, graphics: { main: { type } } }} />);
  const images = container.querySelectorAll('.tv-match-identity img');
  expect(images[0]).toHaveAttribute('src', '/local.png'); expect(images[1]).toHaveAttribute('src', '/visitante.png');
});
test.each(['gol', 'yellow_card', 'red_card', 'substitution', 'rotulo_jugador', 'rotulo_entrenador'])('la jugada %s conserva la identidad del equipo elegido', type => {
  const { container } = render(<OverlayComposition snapshot={{ ...football, graphics: { temporary: { type, data: { team: 'away', playerName: 'Jugador visitante' } } } }} />);
  expect(container.querySelector('.tv-team-event-crest')).toHaveAttribute('src', '/visitante.png');
  expect(container).toHaveTextContent('Jugador visitante');
  expect(container).toHaveTextContent(football.match.awayTeam.shortName);
});
test('el gol por lado y los equipos sin imagen usan la identidad del partido sin adivinar equipos desconocidos', () => {
  const match = { ...football.match, homeTeam: { ...football.match.homeTeam, crest: null } };
  const { container, rerender } = render(<OverlayComposition snapshot={{ ...football, match, graphics: { temporary: { type: 'gol', data: { side: 'home' } } } }} />);
  expect(container.querySelector('.tv-team-event-crest').src).toMatch(/^data:image\/svg\+xml/);
  expect(container).toHaveTextContent(match.homeTeam.shortName);
  expect(graphicTeam({ data: { team: 'unknown', side: 'home' } }, match)).toBeNull();
  rerender(<OverlayComposition snapshot={{ ...football, graphics: { temporary: { type: 'gol', data: { side: 'away' } } } }} />);
  expect(container.querySelector('.tv-team-event-crest')).toHaveAttribute('src', '/visitante.png');
});

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
