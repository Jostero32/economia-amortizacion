const { body } = require('express-validator');
const { validateRequest } = require('./validateRequest');
const { CHARGE_CATEGORIES } = require('../services/amortization/charges');

const CHARGE_TYPES = ['PORCENTAJE', 'VALOR_FIJO'];
const CHARGE_APPLICATIONS = ['UNA_VEZ', 'POR_CUOTA', 'MENSUAL'];
const CHARGE_BASES = ['MONTO_OPERACION', 'SALDO_INSOLUTO', 'CUOTA'];

/**
 * Reglas de un cobro adicional. En la edición todos los campos son opcionales.
 * @param {boolean} isUpdate
 */
function chargeRules(isUpdate) {
  const field = (name) => (isUpdate ? body(name).optional() : body(name));
  const typeOf = (req) => req.body.tipo;

  return [
    field('nombre')
      .trim()
      .notEmpty()
      .withMessage('Ingresa el nombre del cobro.')
      .isLength({ min: 3, max: 150 })
      .withMessage('El nombre debe tener entre 3 y 150 caracteres.'),
    field('categoria')
      .isIn(CHARGE_CATEGORIES)
      .withMessage('Elige una categoría válida: impuesto de ley, seguro o gasto a terceros.'),
    field('tipo')
      .isIn(CHARGE_TYPES)
      .withMessage('El tipo de cobro debe ser porcentaje o valor fijo.'),
    body('porcentaje')
      .if((value, { req }) => typeOf(req) === 'PORCENTAJE' || (isUpdate && value !== undefined))
      .isFloat({ gt: 0, max: 100 })
      .withMessage('El porcentaje debe ser mayor a 0 y máximo 100.'),
    body('valor')
      .if((value, { req }) => typeOf(req) === 'VALOR_FIJO' || (isUpdate && value !== undefined))
      .isFloat({ gt: 0, max: 100000 })
      .withMessage('El valor fijo debe ser mayor a $0 y máximo $100.000.'),
    field('aplicacion')
      .isIn(CHARGE_APPLICATIONS)
      .withMessage('Indica si el cobro es al desembolso o en cada cuota.'),
    body('baseCalculo')
      .optional()
      .isIn(CHARGE_BASES)
      .withMessage('La base de cálculo debe ser el monto, el saldo o la cuota.'),
    body('obligatorio').optional().isBoolean().withMessage('El campo obligatorio debe ser verdadero o falso.').toBoolean(),
    body('anualizarSiPlazoMenorAnio').optional().isBoolean().withMessage('El campo anualizar debe ser verdadero o falso.').toBoolean(),
    body('activo').optional().isBoolean().withMessage('El estado debe ser verdadero o falso.').toBoolean(),
    body('creditTypeId')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage('El producto de crédito indicado no es válido.'),
    body('descripcion')
      .optional({ nullable: true })
      .isLength({ max: 500 })
      .withMessage('La descripción admite máximo 500 caracteres.'),
    validateRequest,
  ];
}

module.exports = {
  validateChargeCreate: chargeRules(false),
  validateChargeUpdate: chargeRules(true),
};
