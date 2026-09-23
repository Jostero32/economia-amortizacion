const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/apiResponse');

function returnValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 'Datos institucionales inválidos.', 400, errors.array());
  }
  return next();
}

const validateInstitution = [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.').isLength({ max: 150 }),
  body('tipo').isIn(['BANCO_PRIVADO', 'COOPERATIVA']).withMessage('El tipo de institución no es válido.'),
  body('ruc').matches(/^\d{13}$/).withMessage('El RUC debe contener 13 dígitos.'),
  body('direccion').trim().notEmpty().withMessage('La dirección es obligatoria.').isLength({ max: 255 }),
  body('telefono').trim().notEmpty().withMessage('El teléfono es obligatorio.').isLength({ max: 50 }),
  body('email').trim().isEmail().withMessage('El correo institucional no es válido.').normalizeEmail(),
  body('sitioWeb')
    .optional({ checkFalsy: true })
    .isURL({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
    .withMessage('El sitio web debe ser una URL HTTP o HTTPS válida.'),
  body('logo').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  body('colorPrincipal').matches(/^#[0-9a-fA-F]{6}$/).withMessage('El color principal debe usar formato hexadecimal.'),
  body('colorSecundario').matches(/^#[0-9a-fA-F]{6}$/).withMessage('El color secundario debe usar formato hexadecimal.'),
  returnValidationErrors,
];

module.exports = { validateInstitution };
