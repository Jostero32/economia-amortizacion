const { MulterError } = require('multer');
const { errorResponse } = require('../utils/apiResponse');

function errorHandler(err, req, res, next) {
  console.error('[Error Middleware]:', err);

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 'El archivo excede el tamaño máximo permitido de 5 MB.', 400);
    }
    return errorResponse(res, `Error en la carga de archivos: ${err.message}`, 400);
  }

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const messages = err.errors.map(e => e.message);
    return errorResponse(res, `Error de validación: ${messages.join(', ')}`, 400);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  return errorResponse(res, message, statusCode);
}

function notFoundHandler(req, res) {
  return errorResponse(res, `Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404);
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
