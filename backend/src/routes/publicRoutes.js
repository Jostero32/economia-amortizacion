const express = require('express');
const router = express.Router();
const institutionController = require('../controllers/institutionController');
const creditProductController = require('../controllers/creditProductController');
const investmentProductController = require('../controllers/investmentProductController');
const simulationController = require('../controllers/simulationController');
const { optionalAuth } = require('../middleware/authMiddleware');
const {
  validateCreditSimulation,
  validateInvestmentSimulation,
} = require('../validators/simulationValidator');

// Institución (Pública)
router.get('/institution', institutionController.getInstitution);

// Catálogo de Créditos (Público)
router.get('/credit-products', creditProductController.getCreditProducts);
router.get('/credit-products/:id', creditProductController.getCreditProductById);

// Simulador de Créditos (PÚBLICO - No requiere Login)
router.post('/simulations/credits', optionalAuth, validateCreditSimulation, simulationController.simulateCredit);
router.post('/simulations/credit', optionalAuth, validateCreditSimulation, simulationController.simulateCredit);
router.get('/simulations/credits/:id', simulationController.getCreditSimulationById);
router.get('/simulations/credits/:id/pdf', simulationController.getCreditSimulationPDF);

// Catálogo de Inversiones (Público)
router.get('/investment-products', investmentProductController.getInvestmentProducts);
router.get('/investment-products/:id', investmentProductController.getInvestmentProductById);

// Simulador de Inversiones (PÚBLICO - No requiere Login)
router.post('/simulations/investments', optionalAuth, validateInvestmentSimulation, simulationController.simulateInvestment);
router.get('/simulations/investments/:id', simulationController.getInvestmentSimulationById);
router.get('/simulations/investments/:id/pdf', simulationController.getInvestmentSimulationPDF);

module.exports = router;
