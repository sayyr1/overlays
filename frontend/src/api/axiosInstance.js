import axios from 'axios';
import { getStoredVisitorSessionId } from '../utils/visitorSession';

const resolvedApiUrl = String(process.env.REACT_APP_API_URL || '').trim();
const baseURL = resolvedApiUrl || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

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

instance.interceptors.request.use(config => {
  const sessionId = getStoredVisitorSessionId();
  if (sessionId) {
    config.headers = config.headers || {};
    config.headers['X-Visitor-Session-Id'] = sessionId;
  }
  return config;
});

export { baseURL };

export default instance;
