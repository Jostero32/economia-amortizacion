const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/apiResponse');

function validateResults(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(
      res,
      'Error de validación: ' + errors.array().map(e => e.msg).join(', '),
      400,
      errors.array()
    );
  }
  next();
}

const validateRegister = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre completo es obligatorio.')
    .isLength({ min: 3 })
    .withMessage('El nombre debe contener al menos 3 caracteres.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El correo electrónico es obligatorio.')
    .isEmail()
    .withMessage('Debe ingresar un correo electrónico válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria.')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres.'),
  body('cedula')
    .optional()
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage('La cédula ecuatoriana debe tener 10 dígitos.'),
  body('telefono')
    .optional()
    .trim(),
  validateResults,
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El correo electrónico es obligatorio.')
    .isEmail()
    .withMessage('Debe ingresar un correo válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria.'),
  validateResults,
];

module.exports = {
  validateRegister,
  validateLogin,
};
