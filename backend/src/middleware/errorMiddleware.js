const { MulterError } = require('multer');
const { errorResponse } = require('../utils/apiResponse');

const GENERIC_ERROR_MESSAGE = 'Ocurrió un problema al procesar tu solicitud. Intenta nuevamente en unos minutos.';

function errorHandler(err, req, res, next) {
  console.error('[Error Middleware]:', err);

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 'El archivo excede el tamaño máximo permitido de 5 MB.', 400);
    }
    return errorResponse(res, 'No se pudo cargar el archivo. Verifica que sea un solo archivo PDF o imagen.', 400);
  }

  // Los mensajes de Sequelize son técnicos y en inglés: se reemplazan por uno comprensible
  if (err.name === 'SequelizeValidationError') {
    return errorResponse(res, 'Algunos datos no son válidos. Revisa el formulario e intenta nuevamente.', 400);
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return errorResponse(res, 'Ya existe un registro con esos datos.', 409);
  }
  if (err.type === 'entity.parse.failed') {
    return errorResponse(res, 'La información enviada no tiene un formato válido.', 400);
  }

  // Errores esperados (httpError, validaciones de archivos): su mensaje está pensado para el usuario
  if (err.statusCode && err.statusCode < 500) {
    return errorResponse(res, err.message, err.statusCode);
  }

  // Errores inesperados: nunca exponer detalles internos
  return errorResponse(res, GENERIC_ERROR_MESSAGE, 500);
}

function notFoundHandler(req, res) {
  return errorResponse(res, `Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404);
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
