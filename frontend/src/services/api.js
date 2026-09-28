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

  // Se pide por /api/uploads/...: detrás del proxy solo las rutas /api llegan al backend
  return `${API_BASE_URL.replace(/\/$/, '')}${assetPath}`;
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
    // Sin respuesta del servidor: problema de red o servidor caído
    const fallbackMessage = error.response
      ? 'Ocurrió un problema al procesar tu solicitud. Intenta nuevamente.'
      : 'No hay conexión con el servidor. Revisa tu internet e intenta nuevamente.';
    const customError = {
      message: error.response?.data?.message || fallbackMessage,
      statusCode: error.response?.status || 0,
      // Errores por campo: { campo: mensaje }
      errors: error.response?.data?.errors || null,
    };
    return Promise.reject(customError);
  }
);

/**
 * Descarga un archivo del API usando la cookie de sesión y lo guarda con el nombre indicado.
 * Se usa en lugar de window.open para que funcione también con endpoints protegidos.
 */
export async function downloadFile(path, fileName) {
  try {
    const response = await axios.get(`${API_BASE_URL}${path}`, {
      responseType: 'blob',
      withCredentials: true,
    });
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    let message = 'No se pudo descargar el archivo. Intenta nuevamente.';
    const data = error.response?.data;
    if (data instanceof Blob) {
      try {
        message = JSON.parse(await data.text()).message || message;
      } catch {
        // La respuesta de error no es JSON: se mantiene el mensaje genérico
      }
    }
    throw { message, statusCode: error.response?.status || 500 };
  }
}

const shortId = (id) => String(id).slice(0, 8);

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
  compareCreditSystems: (data) => api.post('/simulations/credits/compare', data),
  simulateCreditPrepayment: (id, data) => api.post(`/simulations/credits/${id}/prepayment`, data),
  getCreditSimulation: (id) => api.get(`/simulations/credits/${id}`),
  getCreditSimulationPdfUrl: (id) => `${API_BASE_URL}/simulations/credits/${id}/pdf`,
  downloadCreditSimulationPdf: (id) =>
    downloadFile(`/simulations/credits/${id}/pdf`, `Simulacion_Credito_${shortId(id)}.pdf`),

  getInvestmentProducts: () => api.get('/investment-products'),
  getInvestmentProductById: (id) => api.get(`/investment-products/${id}`),
  simulateInvestment: (data) => api.post('/simulations/investments', data),
  getInvestmentSimulation: (id) => api.get(`/simulations/investments/${id}`),
  getInvestmentSimulationPdfUrl: (id) => `${API_BASE_URL}/simulations/investments/${id}/pdf`,
  downloadInvestmentSimulationPdf: (id) =>
    downloadFile(`/simulations/investments/${id}/pdf`, `Simulacion_Inversion_${shortId(id)}.pdf`),
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
  // Imagen del documento con la cookie de sesión (para el reconocimiento facial)
  getDocumentBlob: (id) =>
    axios.get(`${API_BASE_URL}/documents/${id}`, { responseType: 'blob', withCredentials: true }).then((res) => res.data),
  getMyCreditSimulations: () => api.get('/simulations/my'),
  getMySimulations: () => api.get('/simulations/my'),
  downloadCreditApplicationPdf: (application) =>
    downloadFile(`/credit-applications/${application.id}/pdf`, `Solicitud_${application.codigo || shortId(application.id)}.pdf`),
  downloadInvestmentApplicationPdf: (application) =>
    downloadFile(`/investment-applications/${application.id}/pdf`, `Solicitud_${application.codigo || shortId(application.id)}.pdf`),
};


// Verificación de identidad del cliente (una vez por persona)
const imageForm = (fields) => {
  const body = new FormData();
  Object.entries(fields).forEach(([name, value]) => {
    (Array.isArray(value) ? value : [value]).filter(Boolean).forEach((file) => body.append(name, file));
  });
  return body;
};
const multipart = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 };

export const identityService = {
  getMine: () => api.get('/identity/me'),
  start: (consentimientoVersion) => api.post('/identity', { aceptaConsentimiento: true, consentimientoVersion }),
  uploadFront: (id, file) => api.post(`/identity/${id}/anverso`, imageForm({ foto: file }), multipart),
  uploadBack: (id, file, { modeloAnterior = false } = {}) => {
    const body = imageForm({ foto: file });
    if (modeloAnterior) body.append('modeloAnterior', 'true');
    return api.post(`/identity/${id}/reverso`, body, multipart);
  },
  uploadSelfie: (id, selfie, vida = []) => api.post(`/identity/${id}/selfie`, imageForm({ selfie, vida }), multipart),
  // Imagen con la cookie de sesión (titular o asesor)
  getFileBlob: (id, tipo) =>
    axios.get(`${API_BASE_URL}/identity/${id}/archivos/${tipo}`, { responseType: 'blob', withCredentials: true }).then((res) => res.data),
};

// Endpoints de Asesor y Administrador
export const adminService = {
  // Asesor & Admin
  getApplications: () => api.get('/admin/applications'),
  getApplicationById: (id) => api.get(`/admin/applications/${id}`),
  getInvestmentApplicationById: (id) => api.get(`/admin/investment-applications/${id}`),
  updateApplicationStatus: (id, data) => api.patch(`/admin/applications/${id}/status`, data),
  getIdentityVerifications: (estado) => api.get('/admin/identity-verifications', { params: estado ? { estado } : {} }),
  getIdentityMetrics: () => api.get('/admin/identity-verifications/metrics'),
  getIdentityVerification: (id) => api.get(`/admin/identity-verifications/${id}`),
  decideIdentityVerification: (id, data) => api.patch(`/admin/identity-verifications/${id}/decision`, data),

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

  getCharges: () => api.get('/admin/charges'),
  createCharge: (data) => api.post('/admin/charges', data),
  updateCharge: (id, data) => api.put(`/admin/charges/${id}`, data),
  deleteCharge: (id) => api.delete(`/admin/charges/${id}`),

  getInvestmentProducts: () => api.get('/admin/investments'),
  createInvestmentRate: (productId, data) => api.post(`/admin/investments/${productId}/rates`, data),
  updateInvestmentRate: (productId, rateId, data) => api.put(`/admin/investments/${productId}/rates/${rateId}`, data),
  deleteInvestmentRate: (productId, rateId) => api.delete(`/admin/investments/${productId}/rates/${rateId}`),
  createInvestmentProduct: (data) => api.post('/admin/investments', data),
  updateInvestmentProduct: (id, data) => api.put(`/admin/investments/${id}`, data),
  deleteInvestmentProduct: (id) => api.delete(`/admin/investments/${id}`),

  getAuditLogs: () => api.get('/admin/audit'),
};

export default api;
