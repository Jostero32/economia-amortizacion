const AuditLog = require('../models/AuditLog');

/**
 * Registra un evento de auditoría en la base de datos
 * @param {Object} params
 * @param {Object} [params.req] - Objeto Request de Express para capturar IP y usuario
 * @param {string} params.accion - Código de acción (LOGIN, CREAR_CREDITO, etc.)
 * @param {string} params.entidad - Nombre del recurso modificado
 * @param {string|number} [params.entidadId] - Identificador del recurso
 * @param {Object} [params.detalles] - Información adicional en formato objeto/JSON
 * @param {string} [params.usuario] - Nombre o email del usuario
 * @param {string} [params.usuarioId] - UUID del usuario
 * @param {string} [params.rol] - Rol del usuario
 */
async function logAudit({ req, accion, entidad, entidadId, detalles = null, usuario, usuarioId, rol }) {
  try {
    const userEmail = usuario || req?.user?.email || 'ANONIMO';
    const userId = usuarioId || req?.user?.id || null;
    const userRole = rol || req?.user?.rol || 'PUBLICO';
    const clientIp = req?.ip || req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';

    await AuditLog.create({
      usuario: userEmail,
      usuarioId: userId,
      rol: userRole,
      accion,
      entidad,
      entidadId: entidadId ? String(entidadId) : null,
      detalles,
      ip: String(clientIp).replace('::ffff:', ''),
      fecha: new Date(),
    });
  } catch (err) {
    // La auditoría no debe romper la operación de negocio en caso de error de logging
    console.error('Error al registrar auditoría:', err.message);
  }
}

module.exports = {
  logAudit,
};
