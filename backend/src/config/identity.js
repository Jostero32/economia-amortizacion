/**
 * Parámetros de la verificación de identidad (eKYC). Los valores salen de la calibración con cédulas
 * reales (docs/verificacion-identidad.md) y se relajaron por decisión del equipo para que la
 * aprobación automática funcione con clientes reales (docs/fases-verificacion-identidad.md).
 */
const number = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

module.exports = {
  // Versión del texto de consentimiento que acepta el cliente (se guarda con la verificación)
  CONSENT_VERSION: '2026-09',

  // Distancia euclidiana entre descriptores faciales (menor = más parecidos)
  FACE_MATCH_DISTANCE: number('IDENTITY_FACE_MATCH', 0.5),
  FACE_DOUBTFUL_DISTANCE: number('IDENTITY_FACE_DOUBTFUL', 0.6),

  // Evaluaciones permitidas antes de pasar la verificación al asesor
  MAX_ATTEMPTS: number('IDENTITY_MAX_ATTEMPTS', 3),

  // Nitidez mínima (varianza del Laplaciano, tarjeta a 800 px) para leer la MRZ con confianza
  MIN_BACK_SHARPNESS: number('IDENTITY_MIN_BACK_SHARPNESS', 40),

  // Imágenes: tamaño máximo por archivo y lado mayor con el que se guardan
  MAX_UPLOAD_BYTES: 8 * 1024 * 1024,
  MAX_IMAGE_SIDE: 1600,
};
