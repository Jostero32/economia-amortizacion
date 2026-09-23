import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const resolveApiAssetUrl = (assetPath) => {
  if (!assetPath || /^(https?:|data:|blob:)/i.test(assetPath)) return assetPath;
  if (!assetPath.startsWith('/uploads/')) {
    // Archivos de /public: anteponer el base de Vite (p. ej. /economia/simulador/)
    const base = import.meta.env.BASE_URL;
    if (!assetPath.startsWith('/') || assetPath.startsWith(base)) return assetPath;
    return `${base}${assetPath.slice(1)}`;
  }

  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${apiOrigin}${assetPath}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para manejar errores globalmente
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const customError = {
      message: error.response?.data?.message || error.message || 'Error en la conexión con el servidor',
      statusCode: error.response?.status || 500,
      errors: error.response?.data?.errors || null,
    };
    return Promise.reject(customError);
  }
);

// Endpoints de Autenticación
export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
};

// Endpoints Públicos
export const publicService = {
  getInstitution: () => api.get('/institution'),
  getCreditProducts: () => api.get('/credit-products'),
  getCreditProductById: (id) => api.get(`/credit-products/${id}`),
  simulateCredit: (data) => api.post('/simulations/credits', data),
  getCreditSimulation: (id) => api.get(`/simulations/credits/${id}`),
  getCreditSimulationPdfUrl: (id) => `${API_BASE_URL}/simulations/credits/${id}/pdf`,

  getInvestmentProducts: () => api.get('/investment-products'),
  getInvestmentProductById: (id) => api.get(`/investment-products/${id}`),
  simulateInvestment: (data) => api.post('/simulations/investments', data),
  getInvestmentSimulation: (id) => api.get(`/simulations/investments/${id}`),
  getInvestmentSimulationPdfUrl: (id) => `${API_BASE_URL}/simulations/investments/${id}/pdf`,
};

// Endpoints de Cliente
export const clientService = {
  createCreditApplication: (data) => api.post('/credit-applications', data),
  getMyCreditApplications: () => api.get('/credit-applications/my'),
  getCreditApplicationById: (id) => api.get(`/credit-applications/${id}`),

  createInvestmentApplication: (data) => api.post('/investment-applications', data),
  getMyInvestmentApplications: () => api.get('/investment-applications/my'),
  getInvestmentApplicationById: (id) => api.get(`/investment-applications/${id}`),

  uploadDocument: (formData) =>
    api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getDocumentUrl: (id) => `${API_BASE_URL}/documents/${id}`,
  getMyCreditSimulations: () => api.get('/simulations/my'),
};


// Endpoints de Asesor y Administrador
export const adminService = {
  // Asesor & Admin
  getApplications: () => api.get('/admin/applications'),
  getApplicationById: (id) => api.get(`/admin/applications/${id}`),
  getInvestmentApplicationById: (id) => api.get(`/admin/investment-applications/${id}`),
  updateApplicationStatus: (id, data) => api.patch(`/admin/applications/${id}/status`, data),

  getDocuments: () => api.get('/admin/documents'),
  updateDocumentStatus: (id, data) => api.patch(`/admin/documents/${id}/status`, data),

  getUsers: () => api.get('/admin/users'),
  updateUserAccess: (id, data) => api.patch(`/admin/users/${id}/access`, data),
  getSegments: () => api.get('/admin/segments'),

  // Exclusivo Admin
  getInstitution: () => api.get('/admin/institution'),
  updateInstitution: (data) => api.put('/admin/institution', data),
  uploadInstitutionLogo: (formData) =>
    api.post('/admin/institution/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  createCreditProduct: (data) => api.post('/admin/credit-products', data),
  updateCreditProduct: (id, data) => api.put(`/admin/credit-products/${id}`, data),
  deleteCreditProduct: (id) => api.delete(`/admin/credit-products/${id}`),

  createRate: (data) => api.post('/admin/rates', data),
  updateRate: (id, data) => api.put(`/admin/rates/${id}`, data),

  createCharge: (data) => api.post('/admin/charges', data),
  updateCharge: (id, data) => api.put(`/admin/charges/${id}`, data),
  deleteCharge: (id) => api.delete(`/admin/charges/${id}`),

  createInvestmentProduct: (data) => api.post('/admin/investments', data),
  updateInvestmentProduct: (id, data) => api.put(`/admin/investments/${id}`, data),
  deleteInvestmentProduct: (id) => api.delete(`/admin/investments/${id}`),

  getAuditLogs: () => api.get('/admin/audit'),
};

export default api;
