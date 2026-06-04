const VISITOR_SESSION_KEY = 'crm_visitor_session_id';

export const getStoredVisitorSessionId = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return String(window.localStorage.getItem(VISITOR_SESSION_KEY) || '').trim();
  } catch {
    return '';
  }
};

export const setStoredVisitorSessionId = sessionId => {
  if (typeof window === 'undefined') {
    return '';
  }

  const normalized = String(sessionId || '').trim();
  try {
    if (normalized) {
      window.localStorage.setItem(VISITOR_SESSION_KEY, normalized);
    } else {
      window.localStorage.removeItem(VISITOR_SESSION_KEY);
    }
  } catch {
    // noop
  }
  return normalized;
};

export const clearStoredVisitorSessionId = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(VISITOR_SESSION_KEY);
  } catch {
    // noop
  }
};
