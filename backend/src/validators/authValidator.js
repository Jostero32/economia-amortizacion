const { body } = require('express-validator');
const { validateRequest } = require('./validateRequest');
const { PERSON_NAME_PATTERN, isValidCedula, isValidPhone } = require('../utils/identity');

const validateRegister = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('Ingresa tu nombre completo.')
    .bail()
    .isLength({ min: 3, max: 120 })
    .withMessage('El nombre debe tener entre 3 y 120 caracteres.')
    .bail()
    .matches(PERSON_NAME_PATTERN)
    .withMessage('El nombre solo puede contener letras y espacios.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Ingresa tu correo electrónico.')
    .bail()
    .isEmail()
    .withMessage('El correo electrónico no es válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Ingresa una contraseña.')
    .bail()
    .isLength({ min: 8, max: 72 })
    .withMessage('La contraseña debe tener al menos 8 caracteres.')
    .bail()
    .matches(/[A-Za-z]/)
    .withMessage('La contraseña debe incluir al menos una letra.')
    .bail()
    .matches(/\d/)
    .withMessage('La contraseña debe incluir al menos un número.'),
  body('cedula')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidCedula)
    .withMessage('La cédula no es válida. Revisa los 10 dígitos.'),
  body('telefono')
    .optional({ values: 'falsy' })
    .trim()
    .customSanitizer((value) => String(value).replace(/[\s-]/g, ''))
    .custom(isValidPhone)
    .withMessage('Ingresa un celular de 10 dígitos (09...) o un teléfono fijo con código de provincia.'),
  validateRequest,
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Ingresa tu correo electrónico.')
    .bail()
    .isEmail()
    .withMessage('El correo electrónico no es válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Ingresa tu contraseña.'),
  validateRequest,
];

module.exports = {
  validateRegister,
  validateLogin,
};
