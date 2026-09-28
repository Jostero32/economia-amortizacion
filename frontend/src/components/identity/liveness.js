// Misma geometría que backend/src/services/identity/livenessService.js. Aquí solo guía la captura;
// el servidor vuelve a detectar los puntos y envía sus umbrales al iniciar la verificación.
export const DEFAULT_THRESHOLDS = { giro: 0.15, sonrisa: 0.08 };
export const CHALLENGE_LABELS = {
  GIRO_IZQUIERDA: 'Gira la cabeza a tu izquierda',
  GIRO_DERECHA: 'Gira la cabeza a tu derecha',
  SONRISA: 'Sonríe',
};
const mean = (points) => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
});

/** Métricas relativas a los ojos sobre los 68 puntos del rostro. */
export function faceMetrics(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length !== 68
    || landmarks.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const left = mean(landmarks.slice(36, 42));
  const right = mean(landmarks.slice(42, 48));
  const eyeDist = Math.hypot(right.x - left.x, right.y - left.y);
  if (eyeDist < 1e-6) return null;
  const yaw = (landmarks[30].x - (left.x + right.x) / 2) / eyeDist;
  const mouth = Math.hypot(landmarks[54].x - landmarks[48].x, landmarks[54].y - landmarks[48].y) / eyeDist;
  return Number.isFinite(yaw) && Number.isFinite(mouth) && mouth > 0 ? { yaw, mouth } : null;
}

/** Indica cuándo capturar; la aprobación siempre se calcula en el servidor. */
export function checkChallenge(reto, reference, frame, thresholds = DEFAULT_THRESHOLDS) {
  if (!reference || !frame || ![reference.yaw, reference.mouth, frame.yaw, frame.mouth].every(Number.isFinite)
    || reference.mouth <= 0 || frame.mouth <= 0) return false;
  if (reto === 'GIRO_IZQUIERDA') return frame.yaw - reference.yaw >= thresholds.giro;
  if (reto === 'GIRO_DERECHA') return reference.yaw - frame.yaw >= thresholds.giro;
  if (reto === 'SONRISA') return frame.mouth / reference.mouth >= 1 + thresholds.sonrisa;
  return false;
}
