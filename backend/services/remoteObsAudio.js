import crypto from 'node:crypto';
import ObsBridge from '../models/ObsBridge.js';
import OverlayState from '../models/OverlayState.js';

export const bridgeTokenHash = token => crypto.createHash('sha256').update(String(token)).digest('hex');
export const bridgeFresh = (bridge, now = Date.now()) => Boolean(bridge?.heartbeatAt && now - new Date(bridge.heartbeatAt).getTime() < 15000);
export function remoteAudioView(bridge, now = Date.now()) {
  const fresh = bridgeFresh(bridge, now);
  const report = bridge.status || {};
  const sameSource = bridge.inputName === report.inputName;
  return {
    mode: 'bridge', paired: Boolean(bridge.tokenHash), bridgeOnline: fresh,
    connected: fresh && report.connected === true,
    sourceAvailable: fresh && sameSource && report.sourceAvailable === true,
    inputName: bridge.inputName, tournamentId: bridge.tournament ? String(bridge.tournament) : null,
    duckEnabled: bridge.duckEnabled, ambientPercent: bridge.ambientPercent,
    muted: fresh && sameSource ? report.muted : undefined,
    volumePercent: fresh && sameSource ? report.volumePercent : undefined,
    outputPercent: fresh && sameSource ? report.outputPercent : undefined,
    ducking: fresh && sameSource && report.ducking === true,
    inputs: fresh ? report.inputs || [] : [],
    pending: (bridge.commands || []).some(command => command.kind !== 'replay' && new Date(command.expiresAt).getTime() > now),
    replay: { ...(fresh ? report.replay || {} : {}), pending: (bridge.commands || []).some(command => command.kind === 'replay' && new Date(command.expiresAt).getTime() > now) },
    message: !fresh ? bridge.tokenHash ? 'El puente de casa está desconectado. Inícialo en la computadora donde está OBS.' : 'Vincula la computadora de casa para controlar OBS desde Internet.' : !sameSource ? 'Aplicando la fuente seleccionada en OBS…' : report.message || '',
  };
}
export const getBridge = () => ObsBridge.findOneAndUpdate({ key: 'home' }, { $setOnInsert: { key: 'home' } }, { upsert: true, new: true }).select('+tokenHash').lean();
export const remoteObsAudio = {
  async status() { return remoteAudioView(await getBridge()); },
  async pair() {
    const token = crypto.randomBytes(32).toString('base64url');
    await ObsBridge.findOneAndUpdate({ key: 'home' }, { $set: { tokenHash: bridgeTokenHash(token), commands: [], heartbeatAt: null, agentId: null, status: {} }, $inc: { revision: 1 }, $setOnInsert: { key: 'home' } }, { upsert: true });
    return { token };
  },
  async update(input) {
    const bridge = await getBridge();
    const manual = input.muted !== undefined || input.volumePercent !== undefined;
    if (manual && (!bridgeFresh(bridge) || !bridge.status?.connected || bridge.status.inputName !== bridge.inputName || !bridge.status.sourceAvailable)) throw Object.assign(new Error('El puente no está conectado a la fuente BELABOX. No se envió la orden.'), { status: 503 });
    const changes = Object.fromEntries(['inputName', 'tournament', 'duckEnabled', 'ambientPercent'].filter(key => input[key] !== undefined).map(key => [key, input[key]]));
    const update = { $inc: { revision: 1 } };
    if (Object.keys(changes).length) update.$set = changes;
    if (manual) update.$push = { commands: { $each: [{ id: crypto.randomUUID(), inputName: input.inputName || bridge.inputName, ...(input.muted !== undefined ? { muted: input.muted } : {}), ...(input.volumePercent !== undefined ? { volumePercent: input.volumePercent } : {}), expiresAt: new Date(Date.now() + 20000) }], $slice: -30 } };
    const next = await ObsBridge.findOneAndUpdate({ key: 'home' }, update, { new: true }).select('+tokenHash').lean();
    return remoteAudioView(next);
  },
};
export async function bridgePoll(bridge, agentId, report, acknowledged) {
  const now = new Date();
  const owned = await ObsBridge.findOneAndUpdate(
    { _id: bridge._id, tokenHash: bridge.tokenHash, $or: [{ agentId }, { agentId: null }, { heartbeatAt: { $lt: new Date(now.getTime() - 15000) } }] },
    { $set: { agentId, heartbeatAt: now, status: report }, $pull: { commands: { $or: [{ id: { $in: acknowledged } }, { expiresAt: { $lte: now } }] } } },
    { new: true },
  ).lean();
  if (!owned) throw Object.assign(new Error('Ya hay otro puente conectado, o la vinculación fue reemplazada.'), { status: 409 });
  const state = owned.tournament ? await OverlayState.findOne({ tournament: owned.tournament }).lean() : null;
  return {
    serverTime: new Date().toISOString(),
    settings: { revision: owned.revision, inputName: owned.inputName, tournamentId: owned.tournament ? String(owned.tournament) : null, duckEnabled: owned.duckEnabled, ambientPercent: owned.ambientPercent },
    deck: state?.sponsorDeck || {},
    commands: owned.commands,
  };
}
