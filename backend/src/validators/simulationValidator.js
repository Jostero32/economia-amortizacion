const { body } = require('express-validator');
const { validateRequest } = require('./validateRequest');
const { todayISO, addDays } = require('../utils/dates');

// Una operación se puede programar hasta 90 días después de hoy
const MAX_START_DAYS = 90;
const AMOUNT_FORMAT = { decimal_digits: '0,2' };

/**
 * Fecha de desembolso o apertura: formato YYYY-MM-DD, desde hoy (hora de Ecuador) hasta 90 días
 * @param {string} label - "desembolso" o "apertura"
 */
function startDateRule(label) {
  return body('startDate')
    .optional({ values: 'falsy' })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('La fecha debe tener el formato AAAA-MM-DD.')
    .bail()
    .isISO8601({ strict: true })
    .withMessage('La fecha indicada no existe.')
    .bail()
    .custom((value) => value >= todayISO())
    .withMessage(`La fecha de ${label} no puede ser anterior a hoy.`)
    .bail()
    .custom((value) => value <= addDays(todayISO(), MAX_START_DAYS))
    .withMessage(`La fecha de ${label} no puede superar ${MAX_START_DAYS} días desde hoy.`);
}

function amountRule(emptyMessage) {
  return body('amount')
    .notEmpty()
    .withMessage(emptyMessage)
    .bail()
    .isDecimal(AMOUNT_FORMAT)
    .withMessage('El monto debe ser un número con máximo 2 decimales.')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage('El monto debe ser mayor a $0.');
}

const creditRules = [
  body('creditTypeId')
    .notEmpty()
    .withMessage('Selecciona un tipo de crédito.')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El tipo de crédito seleccionado no es válido.'),
  amountRule('Ingresa el monto del crédito.'),
  body('termMonths')
    .notEmpty()
    .withMessage('Ingresa el plazo en meses.')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El plazo debe ser un número entero de meses.'),
  startDateRule('desembolso'),
  body('cargosOpcionales')
    .optional()
    .isArray()
    .withMessage('Los cargos opcionales deben enviarse como una lista.'),
  body('cargosOpcionales.*')
    .isInt({ min: 1 })
    .withMessage('Cada cargo opcional debe ser un identificador válido.'),
];

const validateCreditSimulation = [
  ...creditRules,
  body('amortizationSystem')
    .notEmpty()
    .withMessage('Elige el tipo de cuota: fija (francés) o decreciente (alemán).')
    .bail()
    .toUpperCase()
    .isIn(['FRANCES', 'ALEMAN'])
    .withMessage('El sistema de amortización debe ser FRANCES o ALEMAN.'),
  validateRequest,
];

// La comparación calcula ambos sistemas, por eso no pide el sistema de amortización
const validateCreditComparison = [...creditRules, validateRequest];

const validateInvestmentSimulation = [
  body('investmentProductId')
    .notEmpty()
    .withMessage('Selecciona un producto de inversión.')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El producto de inversión seleccionado no es válido.'),
  amountRule('Ingresa el monto a invertir.'),
  body('termDays')
    .notEmpty()
    .withMessage('Ingresa el plazo en días.')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El plazo debe ser un número entero de días.'),
  startDateRule('apertura'),
  validateRequest,
];

module.exports = {
  MAX_START_DAYS,
  validateCreditSimulation,
  validateCreditComparison,
  validateInvestmentSimulation,
};
