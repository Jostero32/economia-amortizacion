const { body } = require('express-validator');
const { validateRequest } = require('./validateRequest');

const MONEY_FORMAT = { decimal_digits: '0,2' };

/**
 * Límite superior no menor al inferior. En la edición solo se compara si llegan ambos valores;
 * el controlador completa la verificación con los valores guardados.
 */
function notLessThan(minField, message) {
  return (value, { req }) => {
    if (req.body[minField] === undefined || req.body[minField] === '') return true;
    if (Number(value) < Number(req.body[minField])) throw new Error(message);
    return true;
  };
}

function creditProductRules(isUpdate) {
  const field = (name) => (isUpdate ? body(name).optional() : body(name));
  return [
    field('nombre')
      .trim()
      .notEmpty()
      .withMessage('Ingresa el nombre del producto.')
      .bail()
      .isLength({ min: 3, max: 150 })
      .withMessage('El nombre debe tener entre 3 y 150 caracteres.'),
    body('descripcion').optional({ nullable: true }).isLength({ max: 500 }).withMessage('La descripción admite máximo 500 caracteres.'),
    field('segmentId').isInt({ min: 1 }).withMessage('Selecciona el segmento regulatorio del BCE.'),
    field('tasaInstitucion')
      .isFloat({ gt: 0, max: 100 })
      .withMessage('La tasa efectiva anual debe ser mayor a 0 % y máximo 100 %.'),
    field('montoMinimo')
      .isDecimal(MONEY_FORMAT)
      .withMessage('El monto mínimo debe ser un número con máximo 2 decimales.')
      .bail()
      .isFloat({ gt: 0 })
      .withMessage('El monto mínimo debe ser mayor a $0.'),
    field('montoMaximo')
      .isDecimal(MONEY_FORMAT)
      .withMessage('El monto máximo debe ser un número con máximo 2 decimales.')
      .bail()
      .custom(notLessThan('montoMinimo', 'El monto máximo no puede ser menor al monto mínimo.')),
    field('plazoMinimo').isInt({ min: 1, max: 360 }).withMessage('El plazo mínimo debe estar entre 1 y 360 meses.'),
    field('plazoMaximo')
      .isInt({ min: 1, max: 360 })
      .withMessage('El plazo máximo debe estar entre 1 y 360 meses.')
      .bail()
      .custom(notLessThan('plazoMinimo', 'El plazo máximo no puede ser menor al plazo mínimo.')),
    body('icono').optional({ nullable: true }).isLength({ max: 50 }).withMessage('El ícono no es válido.'),
    body('activo').optional().isBoolean().withMessage('El estado debe ser verdadero o falso.').toBoolean(),
    validateRequest,
  ];
}

function investmentProductRules(isUpdate) {
  const field = (name) => (isUpdate ? body(name).optional() : body(name));
  return [
    field('nombre')
      .trim()
      .notEmpty()
      .withMessage('Ingresa el nombre del producto.')
      .bail()
      .isLength({ min: 3, max: 150 })
      .withMessage('El nombre debe tener entre 3 y 150 caracteres.'),
    body('descripcion').optional({ nullable: true }).isLength({ max: 500 }).withMessage('La descripción admite máximo 500 caracteres.'),
    field('montoMinimo')
      .isDecimal(MONEY_FORMAT)
      .withMessage('El monto mínimo debe ser un número con máximo 2 decimales.')
      .bail()
      .isFloat({ gt: 0 })
      .withMessage('El monto mínimo debe ser mayor a $0.'),
    field('montoMaximo')
      .isDecimal(MONEY_FORMAT)
      .withMessage('El monto máximo debe ser un número con máximo 2 decimales.')
      .bail()
      .custom(notLessThan('montoMinimo', 'El monto máximo no puede ser menor al monto mínimo.')),
    // Un depósito a plazo fijo se pacta a 30 días o más
    field('plazoMinimoDias').isInt({ min: 30, max: 3600 }).withMessage('El plazo mínimo debe ser de al menos 30 días.'),
    field('plazoMaximoDias')
      .isInt({ min: 30, max: 3600 })
      .withMessage('El plazo máximo debe estar entre 30 y 3600 días.')
      .bail()
      .custom(notLessThan('plazoMinimoDias', 'El plazo máximo no puede ser menor al plazo mínimo.')),
    field('tasa').isFloat({ gt: 0, max: 100 }).withMessage('La tasa base debe ser mayor a 0 % y máximo 100 %.'),
    body('pagoIntereses')
      .optional()
      .isIn(['AL_VENCIMIENTO', 'MENSUAL'])
      .withMessage('El pago de intereses debe ser al vencimiento o mensual.'),
    body('fuente').optional({ nullable: true }).isLength({ max: 150 }).withMessage('La fuente admite máximo 150 caracteres.'),
    body('activo').optional().isBoolean().withMessage('El estado debe ser verdadero o falso.').toBoolean(),
    validateRequest,
  ];
}

const validateRateCreate = [
  body('creditTypeId').isInt({ min: 1 }).withMessage('Selecciona el producto de crédito.'),
  body('tasa').isFloat({ gt: 0, max: 100 }).withMessage('La tasa efectiva anual debe ser mayor a 0 % y máximo 100 %.'),
  body('fechaVigencia')
    .optional({ values: 'falsy' })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('La fecha de vigencia debe tener el formato AAAA-MM-DD.')
    .bail()
    .isISO8601({ strict: true })
    .withMessage('La fecha de vigencia no existe.'),
  body('fuente').optional({ nullable: true }).isLength({ max: 150 }).withMessage('La fuente admite máximo 150 caracteres.'),
  validateRequest,
];

const validateInvestmentRateCreate = [
  body('plazoMinDias').isInt({ min: 1, max: 3600 }).withMessage('Ingresa el plazo mínimo del tramo en días.'),
  body('plazoMaxDias')
    .isInt({ min: 1, max: 3600 })
    .withMessage('Ingresa el plazo máximo del tramo en días.')
    .bail()
    .custom(notLessThan('plazoMinDias', 'El plazo máximo del tramo no puede ser menor al mínimo.')),
  body('tasa').isFloat({ gt: 0, max: 100 }).withMessage('La tasa debe ser mayor a 0 % y máximo 100 %.'),
  body('fuente').optional({ nullable: true }).isLength({ max: 150 }).withMessage('La fuente admite máximo 150 caracteres.'),
  validateRequest,
];

const validateInvestmentRateUpdate = [
  body('tasa').isFloat({ gt: 0, max: 100 }).withMessage('La tasa debe ser mayor a 0 % y máximo 100 %.'),
  body('fuente').optional({ nullable: true }).isLength({ max: 150 }).withMessage('La fuente admite máximo 150 caracteres.'),
  validateRequest,
];

module.exports = {
  validateInvestmentRateCreate,
  validateInvestmentRateUpdate,
  validateCreditProductCreate: creditProductRules(false),
  validateCreditProductUpdate: creditProductRules(true),
  validateInvestmentProductCreate: investmentProductRules(false),
  validateInvestmentProductUpdate: investmentProductRules(true),
  validateRateCreate,
};
