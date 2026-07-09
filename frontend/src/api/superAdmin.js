import axios from './axiosInstance';

export const getSuperAdminSettings = () => axios.get('/api/super-admin/settings', { withCredentials: true });
export const updateSuperAdminSettings = payload =>
  axios.put('/api/super-admin/settings', payload, { withCredentials: true });

export const getSuperAdminBranding = () => axios.get('/api/super-admin/branding', { withCredentials: true });
export const updateSuperAdminBranding = payload =>
  axios.put('/api/super-admin/branding', payload, { withCredentials: true });
export const getSuperAdminHomeLayout = () => axios.get('/api/super-admin/home-layout', { withCredentials: true });
export const updateSuperAdminHomeLayout = payload =>
  axios.put('/api/super-admin/home-layout', payload, { withCredentials: true });
export const uploadSuperAdminBrandingLogo = formData =>
  axios.post('/api/super-admin/branding/upload-logo', formData, {
    withCredentials: true,
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const getSuperAdminCatalogProfiles = () =>
  axios.get('/api/super-admin/catalog-profiles', { withCredentials: true });
export const applySuperAdminCatalogProfile = payload =>
  axios.post('/api/super-admin/catalog-profiles/apply', payload, { withCredentials: true });

export const getSuperAdminThemes = () => axios.get('/api/super-admin/themes', { withCredentials: true });
export const updateSuperAdminTheme = (scope, payload) =>
  axios.put(`/api/super-admin/themes/${scope}`, payload, { withCredentials: true });

export const getSuperAdminModules = () => axios.get('/api/super-admin/modules', { withCredentials: true });
export const updateSuperAdminModule = (key, payload) =>
  axios.put(`/api/super-admin/modules/${key}`, payload, { withCredentials: true });

export const getSuperAdminAccessControl = () =>
  axios.get('/api/super-admin/access-control', { withCredentials: true });
export const createSuperAdminAccessControlUser = payload =>
  axios.post('/api/super-admin/access-control/users', payload, { withCredentials: true });
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

export const getSuperAdminForms = () => axios.get('/api/super-admin/forms', { withCredentials: true });
export const createSuperAdminForm = payload =>
  axios.post('/api/super-admin/forms', payload, { withCredentials: true });
export const updateSuperAdminForm = (key, payload) =>
  axios.put(`/api/super-admin/forms/${key}`, payload, { withCredentials: true });
export const deleteSuperAdminForm = key =>
  axios.delete(`/api/super-admin/forms/${key}`, { withCredentials: true });

export const getSuperAdminAuditLogs = () =>
  axios.get('/api/super-admin/audit-logs', { withCredentials: true });
