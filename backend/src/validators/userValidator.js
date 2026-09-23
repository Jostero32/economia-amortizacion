const { body, param, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/apiResponse');

function validateResults(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 'Datos de acceso de usuario inválidos.', 400, errors.array());
  }
  return next();
}

const validateUserAccessUpdate = [
  param('id').isUUID().withMessage('El identificador del usuario no es válido.'),
  body('rol')
    .optional()
    .isIn(['ADMIN', 'ASESOR', 'CLIENTE'])
    .withMessage('El rol indicado no es válido.'),
  body('activo')
    .optional()
    .isBoolean()
    .withMessage('El estado activo debe ser verdadero o falso.')
    .toBoolean(),
  body().custom((_value, { req }) => {
    if (req.body.rol === undefined && req.body.activo === undefined) {
      throw new Error('Debe indicar un rol o estado para actualizar.');
    }
    return true;
  }),
  validateResults,
];

module.exports = { validateUserAccessUpdate };
