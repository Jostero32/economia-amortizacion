const { Op } = require('sequelize');
const { IdentityVerification } = require('../../models');
const { todayISO } = require('../../utils/dates');

/** Verificación más reciente del usuario (la que vale: no se inicia otra con una vigente). */
function latestVerification(userId) {
  return IdentityVerification.findOne({ where: { userId }, order: [['createdAt', 'DESC']] });
}

/** Aprobada y con la cédula vigente (si se leyó su vencimiento). */
function isVerified(verification, today = todayISO()) {
  return Boolean(
    verification
    && verification.estado === 'APROBADA'
    && (!verification.vigenteHasta || verification.vigenteHasta >= today)
  );
}

/**
 * Estado de identidad de un usuario.
 * - verificada: puede aprobarse su crédito o inversión.
 * - puedeSolicitar: además, con la verificación en revisión ya puede enviar solicitudes; su
 *   aprobación espera a que el asesor resuelva la identidad.
 */
async function identityStatus(userId) {
  const verification = await latestVerification(userId);
  const verificada = isVerified(verification);
  return {
    verification,
    verificada,
    puedeSolicitar: verificada || verification?.estado === 'EN_REVISION',
  };
}

/**
 * Resumen de identidad de varios usuarios con una sola consulta (listados de solicitudes).
 * @returns {Promise<Map<string, {id: string|null, estado: string|null, verificada: boolean}>>}
 */
async function identitySummaries(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const summaries = new Map(ids.map((id) => [id, { id: null, estado: null, verificada: false }]));
  if (!ids.length) return summaries;
  const verifications = await IdentityVerification.findAll({
    where: { userId: { [Op.in]: ids } },
    attributes: ['id', 'userId', 'estado', 'vigenteHasta', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });
  const today = todayISO();
  for (const verification of verifications) {
    const current = summaries.get(verification.userId);
    if (current.id) continue; // ya se tomó la más reciente
    summaries.set(verification.userId, {
      id: verification.id,
      estado: verification.estado,
      verificada: isVerified(verification, today),
    });
  }
  return summaries;
}

module.exports = {
  latestVerification,
  isVerified,
  identityStatus,
  identitySummaries,
};
