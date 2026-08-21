import Pusher from 'pusher';

let client;
const getClient = () => {
  if (client) return client;
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) return null;
  client = new Pusher({ appId: PUSHER_APP_ID, key: PUSHER_KEY, secret: PUSHER_SECRET, cluster: PUSHER_CLUSTER, useTLS: true });
  return client;
};

export const overlayChannel = tournamentId => `private-overlay-${tournamentId}`;
export const publishOverlayState = async (state) => {
  const pusher = getClient();
  if (!pusher) return false;
  await pusher.trigger(overlayChannel(state.tournamentId), 'overlay-state', state);
  return true;
};
export const authenticateOverlayChannel = (socketId, channelName) => {
  const pusher = getClient();
  if (!pusher) throw new Error('Pusher no está configurado');
  return pusher.authorizeChannel(socketId, channelName);
};
