/**
 * Utilidades para respuestas API estándar
 */

function successResponse(res, data = {}, statusCode = 200, message = null) {
  const payload = {
    success: true,
    data,
  };
  if (message) {
    payload.message = message;
  }
  return res.status(statusCode).json(payload);
}

function errorResponse(res, message = 'Ocurrió un error en el servidor', statusCode = 500, errors = null) {
  const payload = {
    success: false,
    message,
  };
  if (errors) {
    payload.errors = errors;
  }
  return res.status(statusCode).json(payload);
}

module.exports = {
  successResponse,
  errorResponse,
};
