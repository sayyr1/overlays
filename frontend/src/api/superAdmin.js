import axios from './axiosInstance';

export const getSuperAdminSettings = () => axios.get('/api/super-admin/settings', { withCredentials: true });
export const updateSuperAdminSettings = payload =>
  axios.put('/api/super-admin/settings', payload, { withCredentials: true });

export const getSuperAdminBranding = () => axios.get('/api/super-admin/branding', { withCredentials: true });
export const updateSuperAdminBranding = payload =>
  axios.put('/api/super-admin/branding', payload, { withCredentials: true });

export const getSuperAdminModules = () => axios.get('/api/super-admin/modules', { withCredentials: true });
export const updateSuperAdminModule = (key, payload) =>
  axios.put(`/api/super-admin/modules/${key}`, payload, { withCredentials: true });

export const getSuperAdminAccessControl = () =>
  axios.get('/api/super-admin/access-control', { withCredentials: true });
export const updateSuperAdminAccessControlUser = (id, payload) =>
  axios.put(`/api/super-admin/access-control/users/${id}`, payload, { withCredentials: true });
export const updateSuperAdminUserRole = (id, payload) =>
  axios.put(`/api/users/${id}/role`, payload, { withCredentials: true });

export const getSuperAdminPaymentMethods = () =>
  axios.get('/api/super-admin/payment-methods', { withCredentials: true });
export const createSuperAdminPaymentMethod = payload =>
  axios.post('/api/super-admin/payment-methods', payload, { withCredentials: true });
export const updateSuperAdminPaymentMethod = (id, payload) =>
  axios.put(`/api/super-admin/payment-methods/${id}`, payload, { withCredentials: true });
export const deleteSuperAdminPaymentMethod = id =>
  axios.delete(`/api/super-admin/payment-methods/${id}`, { withCredentials: true });

export const getSuperAdminTextSettings = () =>
  axios.get('/api/super-admin/text-settings', { withCredentials: true });
export const updateSuperAdminTextSetting = (key, payload) =>
  axios.put(`/api/super-admin/text-settings/${key}`, payload, { withCredentials: true });

export const getSuperAdminAuditLogs = () =>
  axios.get('/api/super-admin/audit-logs', { withCredentials: true });
