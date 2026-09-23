const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/apiResponse');

function validateResults(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(
      res,
      'Datos de solicitud incompletos o inválidos: ' + errors.array().map(e => e.msg).join(', '),
      400,
      errors.array()
    );
  }
  next();
}

const validateCreditApplication = [
  body('creditTypeId')
    .notEmpty()
    .withMessage('El ID del tipo de crédito es obligatorio.')
    .isInt({ min: 1 })
    .withMessage('El ID del tipo de crédito debe ser un número entero válido.'),
  body('monto')
    .notEmpty()
    .withMessage('El monto solicitado es obligatorio.')
    .isFloat({ min: 1 })
    .withMessage('El monto debe ser mayor a cero.'),
  body('plazoMeses')
    .notEmpty()
    .withMessage('El plazo en meses es obligatorio.')
    .isInt({ min: 1 })
    .withMessage('El plazo debe ser mayor a cero.'),
  body('sistemaAmortizacion')
    .notEmpty()
    .withMessage('El sistema de amortización es obligatorio.')
    .toUpperCase()
    .isIn(['FRANCES', 'ALEMAN'])
    .withMessage('El sistema de amortización debe ser FRANCES o ALEMAN.'),
  body('nombres')
    .trim()
    .notEmpty()
    .withMessage('Los nombres son obligatorios.'),
  body('apellidos')
    .trim()
    .notEmpty()
    .withMessage('Los apellidos son obligatorios.'),
  body('cedula')
    .trim()
    .notEmpty()
    .withMessage('La cédula de identidad es obligatoria.')
    .isLength({ min: 10, max: 10 })
    .withMessage('La cédula ecuatoriana debe tener 10 dígitos.'),
  body('direccion')
    .trim()
    .notEmpty()
    .withMessage('La dirección de domicilio es obligatoria.'),
  body('ciudad')
    .trim()
    .notEmpty()
    .withMessage('La ciudad es obligatoria.'),
  body('telefono')
    .trim()
    .notEmpty()
    .withMessage('El número de teléfono es obligatorio.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El correo electrónico es obligatorio.')
    .isEmail()
    .withMessage('El correo electrónico no es válido.'),
  body('ingresosMensuales')
    .notEmpty()
    .withMessage('Los ingresos mensuales son obligatorios.')
    .isFloat({ min: 0 })
    .withMessage('Los ingresos mensuales deben ser un valor positivo.'),
  body('egresosMensuales')
    .notEmpty()
    .withMessage('Los egresos mensuales son obligatorios.')
    .isFloat({ min: 0 })
    .withMessage('Los egresos mensuales deben ser un valor positivo.'),
  validateResults,
];

const validateInvestmentApplication = [
  body('investmentProductId')
    .notEmpty()
    .withMessage('El producto de inversión es obligatorio.')
    .isInt({ min: 1 })
    .withMessage('ID de producto inválido.'),
  body('monto')
    .notEmpty()
    .withMessage('El monto es obligatorio.')
    .isFloat({ min: 1 })
    .withMessage('El monto debe ser mayor a cero.'),
  body('plazoDias')
    .notEmpty()
    .withMessage('El plazo en días es obligatorio.')
    .isInt({ min: 1 })
    .withMessage('El plazo debe ser mayor a cero.'),
  body('nombres').trim().notEmpty().withMessage('Los nombres son obligatorios.'),
  body('apellidos').trim().notEmpty().withMessage('Los apellidos son obligatorios.'),
  body('cedula').trim().notEmpty().withMessage('La cédula es obligatoria.').isLength({ min: 10, max: 10 }).withMessage('La cédula debe tener 10 dígitos.'),
  body('telefono').trim().notEmpty().withMessage('El teléfono es obligatorio.'),
  body('email').trim().notEmpty().isEmail().withMessage('El correo es obligatorio y debe ser válido.'),
  body('actividadEconomica').trim().notEmpty().withMessage('La actividad económica es obligatoria.'),
  body('ingresosMensuales')
    .notEmpty()
    .withMessage('Los ingresos mensuales son obligatorios.')
    .isFloat({ min: 0 })
    .withMessage('Los ingresos mensuales deben ser un valor positivo.'),
  body('origenFondos').trim().notEmpty().withMessage('El origen de los fondos es obligatorio.'),
  body('finalidadInversion').trim().notEmpty().withMessage('La finalidad de la inversión es obligatoria.'),
  validateResults,
];

module.exports = {
  validateCreditApplication,
  validateInvestmentApplication,
};
