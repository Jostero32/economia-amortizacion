const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { imageUpload } = require('../middleware/uploadMiddleware');
const { validateInstitution } = require('../validators/institutionValidator');
const { validateUserAccessUpdate } = require('../validators/userValidator');
const { validateChargeCreate, validateChargeUpdate } = require('../validators/chargeValidator');
const {
  validateCreditProductCreate,
  validateCreditProductUpdate,
  validateInvestmentProductCreate,
  validateInvestmentProductUpdate,
  validateRateCreate,
  validateInvestmentRateCreate,
  validateInvestmentRateUpdate,
} = require('../validators/productValidator');

const adminController = require('../controllers/adminController');
const applicationController = require('../controllers/applicationController');
const documentController = require('../controllers/documentController');
const institutionController = require('../controllers/institutionController');

// Todas las rutas bajo /api/admin requieren autenticación
router.use(authenticateToken);

// ==========================================
// RUTAS ACCESIBLES POR ASESOR Y ADMIN
// ==========================================
const advisorAuth = requireRole('ASESOR');

// Solicitudes
router.get('/applications', advisorAuth, applicationController.getAllApplications);
router.get('/investment-applications/:id', advisorAuth, applicationController.getInvestmentApplicationById);
router.get('/applications/:id', advisorAuth, applicationController.getCreditApplicationById);
router.patch('/applications/:id/status', advisorAuth, applicationController.updateApplicationStatus);

// Documentos y Validación Biométrica Simulada
router.get('/documents', advisorAuth, documentController.getAllDocuments);
router.patch('/documents/:id/status', advisorAuth, documentController.updateDocumentStatus);

// Listado de usuarios/clientes
router.get('/users', advisorAuth, adminController.getUsers);

// Segmentos regulatorios BCE
router.get('/segments', advisorAuth, adminController.getCreditSegments);

// ==========================================
// RUTAS EXCLUSIVAS PARA ADMINISTRADOR (ADMIN)
// ==========================================
const adminAuth = requireRole('ADMIN');

// Configuración Institución
router.get('/institution', adminAuth, institutionController.getInstitution);
router.put('/institution', adminAuth, validateInstitution, adminController.updateInstitution);
router.post('/institution/logo', adminAuth, imageUpload.single('logo'), adminController.uploadInstitutionLogo);

// Usuarios, roles y estado de acceso
router.patch('/users/:id/access', adminAuth, validateUserAccessUpdate, adminController.updateUserAccess);

// Productos de Crédito
router.post('/credit-products', adminAuth, validateCreditProductCreate, adminController.createCreditProduct);
router.put('/credit-products/:id', adminAuth, validateCreditProductUpdate, adminController.updateCreditProduct);
router.delete('/credit-products/:id', adminAuth, adminController.deleteCreditProduct);

// Tasas con vigencia histórica
router.post('/rates', adminAuth, validateRateCreate, adminController.createRate);
router.put('/rates/:id', adminAuth, adminController.updateRate);

// Cobros Adicionales (SOLCA, Desgravamen, etc.)
router.get('/charges', adminAuth, adminController.getCharges);
router.post('/charges', adminAuth, validateChargeCreate, adminController.createCharge);
router.put('/charges/:id', adminAuth, validateChargeUpdate, adminController.updateCharge);
router.delete('/charges/:id', adminAuth, adminController.deleteCharge);

// Productos de Inversión (Depósito a Plazo Fijo)
router.get('/investments', adminAuth, adminController.getInvestmentProductsAdmin);
router.post('/investments', adminAuth, validateInvestmentProductCreate, adminController.createInvestmentProduct);
router.put('/investments/:id', adminAuth, validateInvestmentProductUpdate, adminController.updateInvestmentProduct);
router.delete('/investments/:id', adminAuth, adminController.deleteInvestmentProduct);

// Tramos de tasas por plazo de los productos de inversión (con histórico)
router.post('/investments/:id/rates', adminAuth, validateInvestmentRateCreate, adminController.createInvestmentRate);
router.put('/investments/:id/rates/:rateId', adminAuth, validateInvestmentRateUpdate, adminController.updateInvestmentRate);
router.delete('/investments/:id/rates/:rateId', adminAuth, adminController.deleteInvestmentRate);

// Auditoría
router.get('/audit', adminAuth, adminController.getAuditLogs);

module.exports = router;
