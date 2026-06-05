const GUEST_ORDER_TRACKING_KEY = 'guest_order_tracking';
const GUEST_ORDER_TRACKING_EVENT = 'guest-order-tracking-updated';

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const getGuestOrderTracking = () => {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(GUEST_ORDER_TRACKING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.lookupToken) return null;
    return parsed;
  } catch {
    return null;
  }
};

const dispatchGuestOrderTrackingUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GUEST_ORDER_TRACKING_EVENT));
};

export const saveGuestOrderTracking = payload => {
  if (!canUseStorage() || !payload?.lookupToken) return;

  const data = {
    lookupToken: payload.lookupToken,
    orderId: payload.orderId || '',
    updatedAt: new Date().toISOString()
  };

  window.localStorage.setItem(GUEST_ORDER_TRACKING_KEY, JSON.stringify(data));
  dispatchGuestOrderTrackingUpdated();
};

export const clearGuestOrderTracking = () => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(GUEST_ORDER_TRACKING_KEY);
  dispatchGuestOrderTrackingUpdated();
};

export const subscribeGuestOrderTracking = callback => {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = () => callback(getGuestOrderTracking());
  const handleStorage = event => {
    if (event.key === GUEST_ORDER_TRACKING_KEY) {
      callback(getGuestOrderTracking());
    }
  };

  window.addEventListener(GUEST_ORDER_TRACKING_EVENT, handleCustomEvent);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(GUEST_ORDER_TRACKING_EVENT, handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
  };
};
