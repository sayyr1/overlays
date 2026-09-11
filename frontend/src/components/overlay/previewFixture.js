// Fictional data for component checks and the offline design review.
const team = (id, name, code, color) => ({
  id, name, shortName: name, code,
  crest: { secureUrl: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="140" viewBox="0 0 120 140"><path fill="${color}" stroke="#ffffff" stroke-width="3" d="M6 6h108v76q-4 36-54 52Q10 118 6 82Z"/><path fill="#ffffff" opacity=".2" d="M44 8h32v114H44z"/><text x="60" y="78" text-anchor="middle" fill="white" font-family="Arial" font-size="24" font-weight="bold">${code}</text></svg>`) },
});
const players = Array.from({ length: 11 }, (_, index) => ({
  starter: true,
  player: { _id: `player-${index}`, number: index + 1, sportsName: ['D. Herrera', 'M. López', 'A. Andrade', 'J. Torres', 'R. Molina', 'S. Castro', 'E. Paredes', 'L. Cevallos', 'N. Rojas', 'A. Valencia', 'F. Benítez'][index] },
}));
export const previewSnapshot = {
  tournament: { name: 'Copa de la Sierra', colors: { primary: '#173c58', accent: '#e9c46a', background: '#101c2a' } },
  match: {
    homeTeam: team('home', 'Deportivo del Norte', 'DNO', '#315b96'),
    awayTeam: team('away', 'Atlético del Valle', 'AVA', '#a3464c'),
    score: { home: 2, away: 1 },
    clock: { elapsedSeconds: 4032, running: false, period: 'Segundo tiempo', addedTime: 0 },
    round: 'Jornada 08', stadium: 'Estadio de la Sierra',
    lineups: { home: players, away: players },
    stats: { home: { possession: 58, shots: 12, onTarget: 6, corners: 5, fouls: 8 }, away: { possession: 42, shots: 8, onTarget: 3, corners: 2, fouls: 11 } },
  },
  graphics: { scoreboardVisible: true, clockVisible: true, channelBugVisible: true },
  sponsors: [{ id: 'demo', name: 'Sierra Sport', category: 'Auspiciante oficial', headline: 'El deporte nos une', phone: 'Contacto comercial', url: 'sierrasport.example', durationSeconds: 10 }],
};
