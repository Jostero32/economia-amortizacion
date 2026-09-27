const { body, param } = require('express-validator');
const { validateRequest } = require('./validateRequest');

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
  validateRequest,
];

module.exports = { validateUserAccessUpdate };
