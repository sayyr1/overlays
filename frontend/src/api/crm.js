import axios from './axiosInstance';

export const getCRMDashboard = async () => {
  const { data } = await axios.get('/api/crm/dashboard', { withCredentials: true });
  return data;
};

export const getCRMPipeline = async () => {
  const { data } = await axios.get('/api/crm/pipeline', { withCredentials: true });
  return data;
};

export const getCRMContacts = async params => {
  const { data } = await axios.get('/api/crm/contacts', { params, withCredentials: true });
  return data;
};

export const getCRMContactDetail = async contactId => {
  const { data } = await axios.get(`/api/crm/contacts/${contactId}`, { withCredentials: true });
  return data;
};

export const updateCRMContact = async (contactId, payload) => {
  const { data } = await axios.put(`/api/crm/contacts/${contactId}`, payload, { withCredentials: true });
  return data;
};

export const linkCRMWhatsAppLead = async payload => {
  const { data } = await axios.post('/api/crm/contacts/link-whatsapp', payload, { withCredentials: true });
  return data;
};

export const createCRMNote = async (contactId, note) => {
  const { data } = await axios.post(`/api/crm/contacts/${contactId}/notes`, { note }, { withCredentials: true });
  return data;
};

export const getCRMTasks = async params => {
  const { data } = await axios.get('/api/crm/tasks', { params, withCredentials: true });
  return data;
};

export const createCRMTask = async payload => {
  const { data } = await axios.post('/api/crm/tasks', payload, { withCredentials: true });
  return data;
};

export const updateCRMTask = async (taskId, payload) => {
  const { data } = await axios.patch(`/api/crm/tasks/${taskId}`, payload, { withCredentials: true });
  return data;
};

export const getAbandonedCarts = async () => {
  const { data } = await axios.get('/api/crm/abandoned-carts', { withCredentials: true });
  return data;
};

export const updateAbandonedCart = async (cartId, status) => {
  const { data } = await axios.patch(`/api/crm/abandoned-carts/${cartId}`, { status }, { withCredentials: true });
  return data;
};

export const getCRMConfig = async () => {
  const { data } = await axios.get('/api/crm/config', { withCredentials: true });
  return data;
};

export const updateCRMConfig = async payload => {
  const { data } = await axios.put('/api/crm/config', payload, { withCredentials: true });
  return data;
};

export const getProductInterest = async productId => {
  const { data } = await axios.get(`/api/crm/products/${productId}/interest`, { withCredentials: true });
  return data;
};
