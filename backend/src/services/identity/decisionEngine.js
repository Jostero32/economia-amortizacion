/**
 * Reglas de decisión de la verificación de identidad (funciones puras, sin acceso a datos).
 *
 * Cada control llega evaluado por los servicios como { codigo, ok, detalle, siFalla }:
 *   ok       true = cumple · false = no cumple · null = no se pudo evaluar
 *   siFalla  qué pasa si no cumple: 'RECHAZO' | 'REINTENTO' | 'REVISION'
 *
 * Orden de las reglas:
 *   1. Un control de rechazo que falla (cédula vencida, menor de edad) → RECHAZADA.
 *   2. Un control de reintento que falla (rostro ausente o distinto) → REINTENTAR, o EN_REVISION si
 *      ya no quedan intentos.
 *   3. Todos los controles requeridos para la aprobación automática presentes y cumplidos → APROBADA.
 *   4. En cualquier otro caso → EN_REVISION (lo decide un asesor), con los motivos concretos.
 */

// Controles que deben cumplirse para aprobar sin asesor. Los de la cédula (MRZ y datos) se evalúan
// desde la fase 2 y la prueba de vida desde la fase 3: mientras falten, la decisión es del asesor.
const AUTO_APPROVAL_CONTROLS = [
  'ROSTRO_CEDULA',
  'ROSTRO_SELFIE',
  'ROSTRO_COINCIDE',
  'MRZ_LEGIBLE',
  'NUI_COINCIDE',
  'CEDULA_UNICA',
  'NOMBRE_COINCIDE',
  'MAYOR_EDAD',
  'CEDULA_VIGENTE',
  'VIDA',
];

const PENDING_DATA_MOTIVE = 'Un asesor revisará los datos de tu cédula.';

/**
 * @param {Object} params
 * @param {Array<{codigo: string, ok: boolean|null, detalle: string, siFalla: string}>} params.controles
 * @param {number} params.intentos - Evaluaciones realizadas, incluida esta
 * @param {number} params.maxIntentos
 * @param {string[]} [params.requeridos] - Controles para la aprobación automática
 * @returns {{resultado: 'APROBADA'|'EN_REVISION'|'RECHAZADA'|'REINTENTAR', aprobacionAutomatica: boolean,
 *   motivos: string[]}}
 */
function decide({ controles, intentos, maxIntentos, requeridos = AUTO_APPROVAL_CONTROLS }) {
  const failed = (kind) => controles.filter((c) => c.ok === false && c.siFalla === kind);

  const rejections = failed('RECHAZO');
  if (rejections.length) {
    return { resultado: 'RECHAZADA', aprobacionAutomatica: false, motivos: rejections.map((c) => c.detalle) };
  }

  const retries = failed('REINTENTO');
  if (retries.length) {
    const motivos = retries.map((c) => c.detalle);
    if (intentos < maxIntentos) return { resultado: 'REINTENTAR', aprobacionAutomatica: false, motivos };
    return {
      resultado: 'EN_REVISION',
      aprobacionAutomatica: false,
      motivos: [...motivos, `Se agotaron los ${maxIntentos} intentos: un asesor revisará tu verificación.`],
    };
  }

  const byCode = new Map(controles.map((c) => [c.codigo, c]));
  const reviews = controles.filter((c) => c.ok !== true).map((c) => c.detalle);
  const missing = requeridos.filter((code) => !byCode.has(code));
  if (!reviews.length && !missing.length) {
    return { resultado: 'APROBADA', aprobacionAutomatica: true, motivos: [] };
  }
  return {
    resultado: 'EN_REVISION',
    aprobacionAutomatica: false,
    motivos: missing.length ? [...reviews, PENDING_DATA_MOTIVE] : reviews,
  };
}

/** Estado que se guarda: reintentar deja la verificación en curso para una nueva captura. */
const storedState = (resultado) => (resultado === 'REINTENTAR' ? 'EN_CURSO' : resultado);

module.exports = {
  AUTO_APPROVAL_CONTROLS,
  PENDING_DATA_MOTIVE,
  decide,
  storedState,
};
