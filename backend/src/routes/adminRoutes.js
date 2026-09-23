const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { imageUpload } = require('../middleware/uploadMiddleware');
const { validateInstitution } = require('../validators/institutionValidator');
const { validateUserAccessUpdate } = require('../validators/userValidator');

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
router.post('/credit-products', adminAuth, adminController.createCreditProduct);
router.put('/credit-products/:id', adminAuth, adminController.updateCreditProduct);
router.delete('/credit-products/:id', adminAuth, adminController.deleteCreditProduct);

// Tasas con vigencia histórica
router.post('/rates', adminAuth, adminController.createRate);
router.put('/rates/:id', adminAuth, adminController.updateRate);

// Cobros Adicionales (SOLCA, Desgravamen, etc.)
router.post('/charges', adminAuth, adminController.createCharge);
router.put('/charges/:id', adminAuth, adminController.updateCharge);
router.delete('/charges/:id', adminAuth, adminController.deleteCharge);

// Productos de Inversión (Depósito a Plazo Fijo)
router.post('/investments', adminAuth, adminController.createInvestmentProduct);
router.put('/investments/:id', adminAuth, adminController.updateInvestmentProduct);
router.delete('/investments/:id', adminAuth, adminController.deleteInvestmentProduct);

// Auditoría
router.get('/audit', adminAuth, adminController.getAuditLogs);

module.exports = router;
