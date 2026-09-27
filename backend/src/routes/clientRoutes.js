const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const documentController = require('../controllers/documentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
  validateCreditApplication,
  validateInvestmentApplication,
} = require('../validators/applicationValidator');

// Todas las rutas de este módulo requieren token de autenticación
router.use(authenticateToken);

// Crear solicitudes y subir documentos es exclusivo del cliente (asesor y admin solo revisan)
const clientOnly = requireRole('CLIENTE');

// Solicitudes de Crédito
router.post('/credit-applications', clientOnly, validateCreditApplication, applicationController.createCreditApplication);
router.get('/credit-applications/my', applicationController.getMyCreditApplications);
router.get('/credit-applications/:id', applicationController.getCreditApplicationById);

// Solicitudes de Inversión
router.post('/investment-applications', clientOnly, validateInvestmentApplication, applicationController.createInvestmentApplication);
router.get('/investment-applications/my', applicationController.getMyInvestmentApplications);
router.get('/investment-applications/:id', applicationController.getInvestmentApplicationById);

// Carga y consulta de Documentos
router.post('/documents', clientOnly, upload.single('archivo'), documentController.uploadDocument);
router.get('/documents/:id', documentController.getDocumentFile);

// Historial de Simulaciones del usuario
router.get('/simulations/my', require('../controllers/simulationController').getMyCreditSimulations);


module.exports = router;
