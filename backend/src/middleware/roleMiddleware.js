const { errorResponse } = require('../utils/apiResponse');

/**
 * Valida que el usuario autenticado cuente con el rol requerido.
 * Regla de negocio: Los usuarios con rol ADMIN tienen acceso implícito a funciones de ASESOR.
 * @param {...string} allowedRoles - Roles permitidos para el endpoint
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Autenticación requerida.', 401);
    }

    const userRole = req.user.rol;

    // Si el rol requerido es ASESOR, ADMIN también tiene permiso
    const isAuthorized = allowedRoles.includes(userRole) || (allowedRoles.includes('ASESOR') && userRole === 'ADMIN');

    if (!isAuthorized) {
      return errorResponse(
        res,
        `Acceso no autorizado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}.`,
        403
      );
    }

    next();
  };
}

module.exports = {
  requireRole,
};
