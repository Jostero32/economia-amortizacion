const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Cierra una cadena de validaciones de express-validator.
 *
 * Responde 400 con un mensaje simple (el primer problema encontrado) y el detalle por campo
 * en `errors` ({ campo: mensaje }) para mostrarlo junto a cada input del formulario.
 */
function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  const errors = {};
  result.array().forEach((error) => {
    const field = error.path || error.param || '_';
    if (!errors[field]) {
      errors[field] = error.msg;
    }
  });

  return errorResponse(res, Object.values(errors)[0], 400, errors);
}

module.exports = { validateRequest };
