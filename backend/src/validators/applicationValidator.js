const { body } = require('express-validator');
const { validateRequest } = require('./validateRequest');
const { todayISO, ageOn } = require('../utils/dates');
const { PERSON_NAME_PATTERN, isValidCedula, isValidPhone } = require('../utils/identity');

const MIN_AGE = 18;
const MAX_AGE = 100;
const ESTADOS_CIVILES = ['Soltero/a', 'Casado/a', 'Unión de hecho', 'Divorciado/a', 'Viudo/a'];
const MONEY_FORMAT = { decimal_digits: '0,2' };

function isAccepted(value) {
  return value === true || value === 'true';
}

function nameRule(field, label) {
  return body(field)
    .trim()
    .notEmpty()
    .withMessage(`Ingresa tus ${label}.`)
    .bail()
    .isLength({ min: 2, max: 100 })
    .withMessage(`Tus ${label} deben tener entre 2 y 100 caracteres.`)
    .bail()
    .matches(PERSON_NAME_PATTERN)
    .withMessage(`Tus ${label} solo pueden contener letras y espacios.`);
}

// Datos de identificación y contacto comunes a créditos e inversiones
const personalDataRules = [
  body('simulationId').optional({ values: 'falsy' }).isUUID().withMessage('La simulación indicada no es válida.'),
  nameRule('nombres', 'nombres'),
  nameRule('apellidos', 'apellidos'),
  body('cedula')
    .trim()
    .notEmpty()
    .withMessage('Ingresa tu número de cédula.')
    .bail()
    .custom(isValidCedula)
    .withMessage('La cédula no es válida. Revisa los 10 dígitos.'),
  body('telefono')
    .trim()
    .notEmpty()
    .withMessage('Ingresa tu número de teléfono.')
    .bail()
    .customSanitizer((value) => String(value).replace(/[\s-]/g, ''))
    .custom(isValidPhone)
    .withMessage('Ingresa un celular de 10 dígitos (09...) o un teléfono fijo con código de provincia.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Ingresa tu correo electrónico.')
    .bail()
    .isEmail()
    .withMessage('El correo electrónico no es válido.'),
  body('actividadEconomica')
    .trim()
    .notEmpty()
    .withMessage('Indica tu actividad económica.')
    .bail()
    .isLength({ max: 150 })
    .withMessage('La actividad económica admite máximo 150 caracteres.'),
  body('ingresosMensuales')
    .notEmpty()
    .withMessage('Ingresa tus ingresos mensuales.')
    .bail()
    .isDecimal(MONEY_FORMAT)
    .withMessage('Los ingresos deben ser un número con máximo 2 decimales.')
    .bail()
    .isFloat({ gt: 0, max: 1000000 })
    .withMessage('Tus ingresos mensuales deben ser mayores a $0.'),
];

const validateCreditApplication = [
  body('creditTypeId')
    .notEmpty()
    .withMessage('Selecciona el tipo de crédito.')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El tipo de crédito no es válido.'),
  body('monto')
    .notEmpty()
    .withMessage('Ingresa el monto solicitado.')
    .bail()
    .isDecimal(MONEY_FORMAT)
    .withMessage('El monto debe ser un número con máximo 2 decimales.')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage('El monto debe ser mayor a $0.'),
  body('plazoMeses')
    .notEmpty()
    .withMessage('Ingresa el plazo en meses.')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El plazo debe ser un número entero de meses.'),
  body('sistemaAmortizacion')
    .notEmpty()
    .withMessage('Elige el tipo de cuota.')
    .bail()
    .toUpperCase()
    .isIn(['FRANCES', 'ALEMAN'])
    .withMessage('El sistema de amortización debe ser FRANCES o ALEMAN.'),
  ...personalDataRules,
  body('fechaNacimiento')
    .notEmpty()
    .withMessage('Ingresa tu fecha de nacimiento.')
    .bail()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('La fecha de nacimiento debe tener el formato AAAA-MM-DD.')
    .bail()
    .isISO8601({ strict: true })
    .withMessage('La fecha de nacimiento no existe.')
    .bail()
    .custom((value) => value < todayISO())
    .withMessage('La fecha de nacimiento no puede ser hoy ni una fecha futura.')
    .bail()
    .custom((value) => ageOn(value) >= MIN_AGE)
    .withMessage('Debes ser mayor de edad para solicitar un crédito.')
    .bail()
    .custom((value) => ageOn(value) <= MAX_AGE)
    .withMessage('Revisa la fecha de nacimiento.'),
  body('estadoCivil')
    .optional({ values: 'falsy' })
    .isIn(ESTADOS_CIVILES)
    .withMessage('Selecciona un estado civil válido.'),
  body('direccion')
    .trim()
    .notEmpty()
    .withMessage('Ingresa tu dirección de domicilio.')
    .bail()
    .isLength({ min: 5, max: 255 })
    .withMessage('La dirección debe tener entre 5 y 255 caracteres.'),
  body('ciudad')
    .trim()
    .notEmpty()
    .withMessage('Ingresa tu ciudad.')
    .bail()
    .isLength({ min: 2, max: 100 })
    .withMessage('La ciudad debe tener entre 2 y 100 caracteres.')
    .bail()
    .matches(PERSON_NAME_PATTERN)
    .withMessage('La ciudad solo puede contener letras y espacios.'),
  body('egresosMensuales')
    .notEmpty()
    .withMessage('Ingresa tus gastos mensuales (puede ser 0).')
    .bail()
    .isDecimal(MONEY_FORMAT)
    .withMessage('Los gastos deben ser un número con máximo 2 decimales.')
    .bail()
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Los gastos mensuales no pueden ser negativos.'),
  body('autorizaConsultaBuro')
    .custom(isAccepted)
    .withMessage('Debes autorizar la consulta de tu historial crediticio para continuar.'),
  validateRequest,
];

const validateInvestmentApplication = [
  body('investmentProductId')
    .notEmpty()
    .withMessage('Selecciona el producto de inversión.')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El producto de inversión no es válido.'),
  body('monto')
    .notEmpty()
    .withMessage('Ingresa el monto a invertir.')
    .bail()
    .isDecimal(MONEY_FORMAT)
    .withMessage('El monto debe ser un número con máximo 2 decimales.')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage('El monto debe ser mayor a $0.'),
  body('plazoDias')
    .notEmpty()
    .withMessage('Ingresa el plazo en días.')
    .bail()
    .isInt({ min: 1 })
    .withMessage('El plazo debe ser un número entero de días.'),
  ...personalDataRules,
  body('origenFondos')
    .trim()
    .notEmpty()
    .withMessage('Indica el origen de los fondos.')
    .bail()
    .isLength({ min: 5, max: 500 })
    .withMessage('Describe el origen de los fondos en 5 a 500 caracteres.'),
  body('finalidadInversion')
    .trim()
    .notEmpty()
    .withMessage('Indica la finalidad de la inversión.')
    .bail()
    .isLength({ min: 5, max: 500 })
    .withMessage('Describe la finalidad de la inversión en 5 a 500 caracteres.'),
  body('declaraLicitudFondos')
    .custom(isAccepted)
    .withMessage('Debes declarar que los fondos tienen un origen lícito para continuar.'),
  validateRequest,
];

module.exports = {
  ESTADOS_CIVILES,
  validateCreditApplication,
  validateInvestmentApplication,
};
