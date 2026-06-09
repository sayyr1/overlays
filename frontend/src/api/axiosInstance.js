import axios from 'axios';
import { getStoredVisitorSessionId } from '../utils/visitorSession';

const resolvedApiUrl = String(process.env.REACT_APP_API_URL || '').trim();
const baseURL = resolvedApiUrl || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');
const AUTH_TOKEN_STORAGE_KEY = 'niway_auth_token';

if (process.env.NODE_ENV !== 'production') {
  console.log('API baseURL:', baseURL);
}

const instance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getStoredAuthToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return String(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '').trim();
};

export const setStoredAuthToken = token => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedToken = String(token || '').trim();
  if (normalizedToken) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalizedToken);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
};

export const clearStoredAuthToken = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
};

instance.interceptors.request.use(config => {
  const sessionId = getStoredVisitorSessionId();
  if (sessionId) {
    config.headers = config.headers || {};
    config.headers['X-Visitor-Session-Id'] = sessionId;
  }

  const authToken = getStoredAuthToken();
  if (authToken) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
  }

  return config;
});

export { baseURL };

export default instance;
