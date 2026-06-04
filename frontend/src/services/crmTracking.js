import axios from '../api/axiosInstance';
import { getStoredVisitorSessionId, setStoredVisitorSessionId } from '../utils/visitorSession';

const safePost = async (url, payload = {}) => {
  try {
    const { data } = await axios.post(url, payload, { withCredentials: true });
    if (data?.sessionId) {
      setStoredVisitorSessionId(data.sessionId);
    }
    return data;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`CRM tracking error at ${url}`, error);
    }
    return null;
  }
};

export const ensureVisitorSession = async ({
  landingPage = '',
  referrer = '',
  source = '',
  medium = '',
  campaign = ''
} = {}) => {
  return safePost('/api/tracking/session', {
    sessionId: getStoredVisitorSessionId(),
    landingPage,
    referrer,
    source,
    medium,
    campaign
  });
};

export const trackStoreVisit = async payload => {
  return ensureVisitorSession(payload);
};

export const trackProductView = async ({ productId, title = '', path = '', name = '', phone = '', email = '' }) => {
  return safePost('/api/tracking/product-view', {
    sessionId: getStoredVisitorSessionId(),
    productId,
    title,
    path,
    name,
    phone,
    email
  });
};

export const trackWhatsAppClick = async ({ productId, title = '', href = '' }) => {
  return safePost('/api/tracking/whatsapp-click', {
    sessionId: getStoredVisitorSessionId(),
    productId,
    title,
    href
  });
};

export const captureContactLead = async ({ name = '', phone = '', email = '', productId = '' }) => {
  return safePost('/api/tracking/contact-capture', {
    sessionId: getStoredVisitorSessionId(),
    name,
    phone,
    email,
    productId
  });
};

export const trackCartState = async ({
  items = [],
  status = 'active',
  eventType = '',
  contactName = '',
  contactPhone = '',
  contactEmail = ''
}) => {
  return safePost('/api/tracking/cart', {
    sessionId: getStoredVisitorSessionId(),
    items,
    status,
    eventType,
    contactName,
    contactPhone,
    contactEmail
  });
};

export const trackCheckoutStarted = async ({
  items = [],
  contactName = '',
  contactPhone = '',
  contactEmail = ''
}) => {
  return trackCartState({
    items,
    status: 'checkout_started',
    eventType: 'checkout_started',
    contactName,
    contactPhone,
    contactEmail
  });
};
