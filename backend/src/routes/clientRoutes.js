const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const documentController = require('../controllers/documentController');
const identityController = require('../controllers/identityController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { identityUpload } = require('../middleware/uploadMiddleware');
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
router.get('/credit-applications/:id/pdf', applicationController.getCreditApplicationPDF);

// Solicitudes de Inversión
router.post('/investment-applications', clientOnly, validateInvestmentApplication, applicationController.createInvestmentApplication);
router.get('/investment-applications/my', applicationController.getMyInvestmentApplications);
router.get('/investment-applications/:id', applicationController.getInvestmentApplicationById);
router.get('/investment-applications/:id/pdf', applicationController.getInvestmentApplicationPDF);

// Carga y consulta de Documentos
router.post('/documents', clientOnly, upload.single('archivo'), documentController.uploadDocument);
router.get('/documents/:id', documentController.getDocumentFile);

// Verificación de identidad (una vez por persona; la decisión se calcula en el servidor)
router.get('/identity/me', clientOnly, identityController.getMyVerification);
router.post('/identity', clientOnly, identityController.startVerification);
router.post('/identity/:id/anverso', clientOnly, identityUpload.single('foto'), identityController.uploadFront);
router.post('/identity/:id/reverso', clientOnly, identityUpload.single('foto'), identityController.uploadBack);
router.post(
  '/identity/:id/selfie',
  clientOnly,
  identityUpload.fields([{ name: 'selfie', maxCount: 1 }, { name: 'vida', maxCount: 4 }]),
  identityController.uploadSelfie
);
// Imágenes: el titular, el asesor o el administrador (se valida en el controlador)
router.get('/identity/:id/archivos/:tipo', identityController.getFile);

// Historial de Simulaciones del usuario
router.get('/simulations/my', require('../controllers/simulationController').getMyCreditSimulations);


module.exports = router;
