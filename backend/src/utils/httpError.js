/**
 * Error con código HTTP para lanzarlo desde servicios; errorMiddleware usa `statusCode`
 * y muestra el mensaje tal cual, por lo que debe ser claro para el usuario final.
 */
function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = { httpError };
