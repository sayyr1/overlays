import crypto from 'node:crypto';
import ObsOutput from '../models/ObsOutput.js';
import Tournament from '../models/Tournament.js';
import OverlayState from '../models/OverlayState.js';

export const outputTokenHash = token => crypto.createHash('sha256').update(String(token)).digest('hex');
export async function getOutput() {
  await ObsOutput.init();
  const token = crypto.randomBytes(32).toString('base64url');
  return ObsOutput.findOneAndUpdate({ key: 'program' }, { $setOnInsert: { key: 'program', token, tokenHash: outputTokenHash(token) } }, { upsert: true, new: true }).select('+token +tokenHash').lean();
}
export async function outputView(output, now = Date.now()) {
  const [event, state] = output.tournament ? await Promise.all([
    Tournament.findById(output.tournament).select('name active').lean(),
    OverlayState.findOne({ tournament: output.tournament }).select('revision sponsorDeck').lean(),
  ]) : [null, null];
  const connected = Boolean(output.lastSeenAt && now - new Date(output.lastSeenAt).getTime() < 20000);
  const available = Boolean(event && event.active !== false);
  return {
    overlayUrl: `/overlay/programa?token=${output.token}`,
    tournament: event ? { id: String(event._id), name: event.name, active: event.active !== false } : null,
    revision: output.revision,
    connected,
    applied: connected && available && output.seenRevision === output.revision,
    stateConfirmed: connected && available && output.seenRevision === output.revision && output.seenStateRevision >= (state?.revision || 0),
    seenStateRevision: output.seenStateRevision,
    sponsorDeck: event && event.active !== false ? state?.sponsorDeck || {} : {},
  };
}
export function findOutput(token) {
  if (!/^[\w-]{43}$/.test(String(token || ''))) return Promise.resolve(null);
  return ObsOutput.findOne({ key: 'program', tokenHash: outputTokenHash(token) }).lean();
}
