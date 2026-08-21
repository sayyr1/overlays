import crypto from 'crypto';
import SportsMatch from '../models/SportsMatch.js';
import SportsEvent from '../models/SportsEvent.js';
import { currentElapsedSeconds, pauseClock, startClock } from './sportsClock.js';
import { getOverlaySnapshot, updateOverlayState } from './overlayStateService.js';

const controlError = (message, status = 400) => Object.assign(new Error(message), { status });

export const runMatchControl = async ({ matchId, input = {}, actorId = null }) => {
  const match = await SportsMatch.findById(matchId);
  if (!match) throw controlError('Partido no encontrado.', 404);

  const action = String(input.action || '');
  const before = match.toObject();
  const now = new Date();
  let graphic = null;
  let eventType = action;

  if (action === 'goal_home' || action === 'goal_away') {
    const side = action.endsWith('home') ? 'home' : 'away';
    match.score[side] += 1;
    eventType = 'gol';
    graphic = { type: 'gol', data: { ...(input.data || {}), side, teamName: input.teamName || '' } };
  } else if (action === 'score_manual') {
    match.score.home = Math.max(0, Number(input.home) || 0);
    match.score.away = Math.max(0, Number(input.away) || 0);
    eventType = 'correccion_marcador';
  } else if (action === 'penalty_home' || action === 'penalty_away') {
    const side = action.endsWith('home') ? 'home' : 'away';
    match.score[side === 'home' ? 'penaltiesHome' : 'penaltiesAway'] += 1;
    match.clock.period = 'Penales';
    eventType = 'penal_convertido';
    graphic = { type: 'penal', data: { ...(input.data || {}), side, teamName: input.teamName || '' } };
  } else if (action === 'clock_start') {
    match.clock = startClock(match.clock, now);
    match.status = 'en_vivo';
  } else if (action === 'clock_pause') {
    match.clock = pauseClock(match.clock, now);
  } else if (action === 'clock_reset') {
    match.clock = { elapsedSeconds: 0, startedAt: null, running: false, period: match.clock.period, addedTime: 0 };
  } else if (action === 'clock_correct') {
    match.clock = { ...pauseClock(match.clock, now), elapsedSeconds: Math.max(0, Number(input.seconds) || 0) };
    eventType = 'correccion_cronometro';
  } else if (action === 'clock_add') {
    match.clock = { ...pauseClock(match.clock, now), elapsedSeconds: Math.max(0, currentElapsedSeconds(match.clock, now) + (Number(input.seconds) || 0)) };
  } else if (action === 'period') {
    match.clock.period = String(input.period || 'Primer tiempo');
    match.status = input.status || (match.clock.period === 'Descanso' ? 'descanso' : match.status);
    eventType = 'cambio_periodo';
  } else if (action === 'added_time') {
    match.clock.addedTime = Math.max(0, Number(input.minutes) || 0);
  } else if (action === 'stats') {
    const side = ['home', 'away'].includes(input.side) ? input.side : null;
    const field = ['possession', 'shots', 'onTarget', 'corners', 'fouls'].includes(input.field) ? input.field : null;
    if (!side || !field) throw controlError('Estadística no válida.');
    const value = Math.max(0, Number(input.value) || 0);
    match.stats[side][field] = field === 'possession' ? Math.min(100, value) : value;
    if (field === 'possession') match.stats[side === 'home' ? 'away' : 'home'].possession = 100 - match.stats[side].possession;
    eventType = 'actualizacion_estadistica';
  } else if (action === 'discipline') {
    const side = ['home', 'away'].includes(input.side) ? input.side : null;
    const field = ['yellowCards', 'redCards'].includes(input.field) ? input.field : null;
    if (!side || !field) throw controlError('Tarjeta no válida.');
    match.discipline[side][field] = Math.max(0, (Number(match.discipline[side][field]) || 0) + (Number(input.delta) || 0));
    eventType = field === 'redCards' ? 'tarjeta_roja' : 'tarjeta_amarilla';
    graphic = { type: field === 'redCards' ? 'red_card' : 'yellow_card', data: input.data || {} };
  } else if (action === 'graphic') {
    const type = String(input.type || 'aviso');
    const duration = input.duration === undefined ? 8000 : Math.max(0, Number(input.duration) || 0);
    graphic = { id: crypto.randomUUID(), type, data: input.data || {}, activatedAt: now, expiresAt: duration ? new Date(now.getTime() + duration) : null, duration };
    const mainTypes = ['presentacion', 'enfrentamiento', 'alineacion_local', 'alineacion_visitante', 'formacion_local', 'formacion_visitante', 'descanso', 'resultado_final', 'estadisticas', 'tabla_vivo', 'arbitros'];
    const lowerTypes = ['rotulo_jugador', 'rotulo_entrenador', 'narradores', 'comentaristas', 'rotulo', 'jugador_destacado'];
    if (mainTypes.includes(type)) {
      const isFullscreen = ['descanso', 'resultado_final', 'estadisticas', 'tabla_vivo'].includes(type);
      await updateOverlayState(match.tournament, { mainGraphic: graphic, ...(isFullscreen ? { scoreboardVisible: false, temporaryGraphic: null } : {}) }, actorId);
      await SportsEvent.create({ match: match._id, tournament: match.tournament, type: `grafico_${type}`, period: match.clock.period, actor: actorId, reversible: false });
      return { match, snapshot: await getOverlaySnapshot(match.tournament) };
    }
    if (lowerTypes.includes(type)) {
      await updateOverlayState(match.tournament, { lowerThird: graphic }, actorId);
      await SportsEvent.create({ match: match._id, tournament: match.tournament, type: `rotulo_${type}`, period: match.clock.period, actor: actorId, reversible: false });
      return { match, snapshot: await getOverlaySnapshot(match.tournament) };
    }
  } else if (action === 'hide_graphic') {
    const layer = String(input.layer || 'temporary');
    const changes = layer === 'main' ? { mainGraphic: null } : layer === 'lower' ? { lowerThird: null } : { temporaryGraphic: null };
    await updateOverlayState(match.tournament, changes, actorId);
    return { match, snapshot: await getOverlaySnapshot(match.tournament) };
  } else if (action === 'clear_graphics') {
    await updateOverlayState(match.tournament, { mainGraphic: null, temporaryGraphic: null, lowerThird: null }, actorId);
    return { match, snapshot: await getOverlaySnapshot(match.tournament) };
  } else if (action === 'hide_all') {
    await updateOverlayState(match.tournament, { mainGraphic: null, temporaryGraphic: null, lowerThird: null, scoreboardVisible: false, clockVisible: false, channelBugVisible: false, sponsorBugVisible: false }, actorId);
    return { match, snapshot: await getOverlaySnapshot(match.tournament) };
  } else if (action === 'scoreboard') {
    await updateOverlayState(match.tournament, { scoreboardVisible: Boolean(input.visible) }, actorId);
    return { match, snapshot: await getOverlaySnapshot(match.tournament) };
  } else if (action === 'layer') {
    const allowed = ['clockVisible', 'channelBugVisible', 'sponsorBugVisible'];
    const field = String(input.field || '');
    if (!allowed.includes(field)) throw controlError('Capa permanente no válida.');
    await updateOverlayState(match.tournament, { [field]: Boolean(input.visible) }, actorId);
    return { match, snapshot: await getOverlaySnapshot(match.tournament) };
  } else if (action === 'preset') {
    const preset = String(input.preset || '');
    const presets = {
      inicio: { mainGraphic: { id: crypto.randomUUID(), type: 'presentacion', activatedAt: now, data: {} }, temporaryGraphic: null, lowerThird: null, scoreboardVisible: false, clockVisible: false },
      juego: { mainGraphic: null, temporaryGraphic: null, scoreboardVisible: true, clockVisible: true },
      descanso: { mainGraphic: { id: crypto.randomUUID(), type: 'descanso', activatedAt: now, data: {} }, temporaryGraphic: null, lowerThird: null, scoreboardVisible: false, clockVisible: false },
      segundo_tiempo: { mainGraphic: null, temporaryGraphic: null, scoreboardVisible: true, clockVisible: true },
      final: { mainGraphic: { id: crypto.randomUUID(), type: 'resultado_final', activatedAt: now, data: {} }, temporaryGraphic: null, lowerThird: null, scoreboardVisible: false, clockVisible: false }
    };
    if (!presets[preset]) throw controlError('Escena rápida no válida.');
    if (preset === 'segundo_tiempo') {
      match.clock.period = 'Segundo tiempo';
      match.status = 'en_vivo';
    }
    if (preset === 'final') {
      match.clock = pauseClock(match.clock, now);
      match.status = 'finalizado';
    }
    await match.save();
    const { snapshot } = await updateOverlayState(match.tournament, presets[preset], actorId);
    await SportsEvent.create({ match: match._id, tournament: match.tournament, type: `preset_${preset}`, period: match.clock.period, actor: actorId, reversible: false });
    return { match, snapshot };
  } else if (['yellow_card', 'red_card', 'var', 'injury', 'penalty_missed'].includes(action)) {
    graphic = { type: action, data: input.data || {} };
  } else {
    throw controlError('Acción de control no reconocida.');
  }

  if (graphic && !graphic.id) {
    const duration = input.duration === undefined ? 8000 : Math.max(0, Number(input.duration) || 0);
    graphic = { id: crypto.randomUUID(), ...graphic, activatedAt: now, expiresAt: duration ? new Date(now.getTime() + duration) : null, duration };
  }
  await match.save();
  const stateChanges = action === 'clock_start'
    ? { clockVisible: true, scoreboardVisible: true, ...(graphic ? { temporaryGraphic: graphic } : {}) }
    : graphic ? { temporaryGraphic: graphic } : {};
  const { snapshot } = await updateOverlayState(match.tournament, stateChanges, actorId);
  await SportsEvent.create({
    match: match._id, tournament: match.tournament, team: input.team, player: input.player,
    playerIn: input.playerIn, playerOut: input.playerOut, type: eventType,
    minute: Math.floor(currentElapsedSeconds(match.clock) / 60), period: match.clock.period,
    data: input.data, previousState: { match: before }, actor: actorId,
    reversible: action !== 'clock_start' && action !== 'clock_pause'
  });
  return { match, snapshot };
};
