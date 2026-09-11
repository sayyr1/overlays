import crypto from 'crypto';

export const broadcastModes = ['sports', 'presentation', 'irl', 'general'];
export const broadcastTypes = ['opening', 'break', 'ending', 'countdown', 'speaker', 'topic', 'location', 'social', 'announcement'];
export const defaultBroadcastScenes = (mode, name) => {
  if (mode === 'sports') return [];
  const scenes = [
    ['opening', 'Inicio', name, 'Bienvenidos a la transmisión'],
    ['countdown', 'Comenzamos pronto', name, 'En unos momentos comenzamos'],
    ['break', 'Pausa', 'Volvemos enseguida', 'Gracias por acompañarnos'],
    ['ending', 'Cierre', 'Gracias por acompañarnos', name],
    ['speaker', mode === 'presentation' ? 'Presentador / invitado' : 'Conductor', '', ''],
    ['topic', 'Tema del momento', '', ''],
    [mode === 'irl' ? 'location' : 'announcement', mode === 'irl' ? 'Ubicación' : 'Aviso', '', ''],
    ['social', 'Redes y contacto', '', ''],
  ];
  return scenes.map(([type, label, title, subtitle]) => ({ id: crypto.randomUUID(), type, label, title, subtitle, seconds: 300, duration: 0 }));
};

const invalid = message => Object.assign(new Error(message), { status: 400 });
export const broadcastChanges = (tournament, input, now = new Date()) => {
  if ((tournament.mode || 'sports') === 'sports') throw invalid('Usa el control deportivo para este torneo.');
  if (input.action === 'clear') return { mainGraphic: null, lowerThird: null, temporaryGraphic: null, scoreboardVisible: false, clockVisible: false, sponsorBugVisible: false, channelBugVisible: false };
  if (input.action === 'hide') {
    if (!['main', 'lower', 'temporary'].includes(input.layer)) throw invalid('Capa no válida.');
    const layer = { main: 'mainGraphic', lower: 'lowerThird', temporary: 'temporaryGraphic' }[input.layer];
    if (!layer) throw invalid('Capa no válida.');
    return { [layer]: null };
  }
  if (input.action === 'sponsors') return { sponsorBugVisible: Boolean(input.visible) };
  if (input.action !== 'take') throw invalid('Acción de transmisión no válida.');
  const scene = tournament.broadcast?.scenes?.find(item => item.id === input.sceneId);
  if (!scene || !broadcastTypes.includes(scene.type)) throw invalid('Gráfico guardado no encontrado.');
  if (!scene.title?.trim()) throw invalid('Completa el título del gráfico antes de emitirlo.');
  const layer = ['opening', 'break', 'ending', 'countdown'].includes(scene.type) ? 'mainGraphic' : scene.type === 'announcement' ? 'temporaryGraphic' : 'lowerThird';
  const graphic = {
    id: crypto.randomUUID(), type: `broadcast_${scene.type}`,
    data: { sceneId: scene.id, title: scene.title, subtitle: scene.subtitle, seconds: scene.seconds },
    activatedAt: now, expiresAt: scene.duration ? new Date(now.getTime() + scene.duration * 1000) : null,
    duration: (scene.duration || 0) * 1000,
  };
  return { scoreboardVisible: false, clockVisible: false,
    ...(layer === 'mainGraphic' ? { lowerThird: null, temporaryGraphic: null } : {}), [layer]: graphic };
};
