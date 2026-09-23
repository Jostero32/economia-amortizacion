const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const documentController = require('../controllers/documentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
  validateCreditApplication,
  validateInvestmentApplication,
} = require('../validators/applicationValidator');

// Todas las rutas de este módulo requieren token de autenticación
router.use(authenticateToken);

// Solicitudes de Crédito
router.post('/credit-applications', validateCreditApplication, applicationController.createCreditApplication);
router.get('/credit-applications/my', applicationController.getMyCreditApplications);
router.get('/credit-applications/:id', applicationController.getCreditApplicationById);

// Solicitudes de Inversión
router.post('/investment-applications', validateInvestmentApplication, applicationController.createInvestmentApplication);
router.get('/investment-applications/my', applicationController.getMyInvestmentApplications);
router.get('/investment-applications/:id', applicationController.getInvestmentApplicationById);

// Carga y consulta de Documentos
router.post('/documents', upload.single('archivo'), documentController.uploadDocument);
router.get('/documents/:id', documentController.getDocumentFile);

// Historial de Simulaciones del usuario
router.get('/simulations/my', require('../controllers/simulationController').getMyCreditSimulations);


module.exports = router;
