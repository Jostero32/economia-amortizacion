const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/apiResponse');

function isTodayOrFutureDate(value) {
  if (!value) return true;
  const inputDate = new Date(`${value}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return inputDate >= today;
}

function validateResults(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(
      res,
      'Datos de simulación inválidos: ' + errors.array().map(e => e.msg).join(', '),
      400,
      errors.array()
    );
  }
  next();
}

const validateCreditSimulation = [
  body('creditTypeId')
    .notEmpty()
    .withMessage('El tipo de crédito es obligatorio.')
    .isInt({ min: 1 })
    .withMessage('El ID del tipo de crédito debe ser un número entero válido.'),
  body('amount')
    .notEmpty()
    .withMessage('El monto del crédito es obligatorio.')
    .isFloat({ min: 1 })
    .withMessage('El monto debe ser un valor numérico mayor a 0.'),
  body('termMonths')
    .notEmpty()
    .withMessage('El plazo en meses es obligatorio.')
    .isInt({ min: 1 })
    .withMessage('El plazo debe ser un número entero positivo mayor a 0.'),
  body('amortizationSystem')
    .notEmpty()
    .withMessage('El sistema de amortización es obligatorio.')
    .toUpperCase()
    .isIn(['FRANCES', 'ALEMAN'])
    .withMessage('El sistema de amortización debe ser FRANCES o ALEMAN.'),
  body('startDate')
    .optional()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('La fecha de inicio debe tener formato válido YYYY-MM-DD.')
    .bail()
    .custom(isTodayOrFutureDate)
    .withMessage('La fecha de inicio debe ser hoy o una fecha futura.'),
  validateResults,
];

const validateInvestmentSimulation = [
  body('investmentProductId')
    .notEmpty()
    .withMessage('El producto de inversión es obligatorio.')
    .isInt({ min: 1 })
    .withMessage('El ID del producto de inversión debe ser un número entero.'),
  body('amount')
    .notEmpty()
    .withMessage('El monto de inversión es obligatorio.')
    .isFloat({ min: 1 })
    .withMessage('El monto a invertir debe ser mayor a 0.'),
  body('termDays')
    .notEmpty()
    .withMessage('El plazo en días es obligatorio.')
    .isInt({ min: 1 })
    .withMessage('El plazo debe ser mayor a 0 días.'),
  body('startDate')
    .optional()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('La fecha de inicio debe tener formato válido YYYY-MM-DD.')
    .bail()
    .custom(isTodayOrFutureDate)
    .withMessage('La fecha de inicio debe ser hoy o una fecha futura.'),
  validateResults,
];

module.exports = {
  validateCreditSimulation,
  validateInvestmentSimulation,
};
