const { randomInt } = require('crypto');
const { YAW_DELTA, SMILE_DELTA, FACE_DOUBTFUL_DISTANCE } = require('../../config/identity');
const { compareFaces } = require('./faceService');

const CHALLENGES = ['GIRO_IZQUIERDA', 'GIRO_DERECHA', 'SONRISA'];
const LABELS = { GIRO_IZQUIERDA: 'Giro a tu izquierda', GIRO_DERECHA: 'Giro a tu derecha', SONRISA: 'Sonrisa' };
const mean = (points) => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
});

/** Dos retos distintos elegidos por el servidor para cada inicio o reanudación. */
function generateChallenges() {
  const remaining = [...CHALLENGES];
  return [remaining.splice(randomInt(remaining.length), 1)[0], remaining.splice(randomInt(remaining.length), 1)[0]];
}

/** Métricas sobre los 68 puntos relativos del rostro; null si no son utilizables. */
function faceMetrics(landmarks) {
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

/** Comprueba el movimiento relativo a la selfie frontal, en imágenes sin espejo. */
function checkChallenge(reto, reference, frame) {
  if (!reference || !frame || ![reference.yaw, reference.mouth, frame.yaw, frame.mouth].every(Number.isFinite)
    || reference.mouth <= 0 || frame.mouth <= 0) return false;
  if (reto === 'GIRO_IZQUIERDA') return frame.yaw - reference.yaw >= YAW_DELTA;
  if (reto === 'GIRO_DERECHA') return reference.yaw - frame.yaw >= YAW_DELTA;
  if (reto === 'SONRISA') return frame.mouth / reference.mouth >= 1 + SMILE_DELTA;
  return false;
}

const validDescriptor = (face) => Array.isArray(face?.descriptor)
  && face.descriptor.length === 128 && face.descriptor.every(Number.isFinite);

/** Verifica identidad y movimiento de cada fotograma, en el orden de los retos del servidor. */
function evaluateLiveness({ retos, selfieFace, frameFaces = [] }) {
  if (!Array.isArray(retos) || retos.length !== 2 || new Set(retos).size !== 2
    || retos.some((reto) => !CHALLENGES.includes(reto))) {
    return { superada: false, resultados: [{ reto: null, ok: false, detalle: 'Inicia de nuevo la verificación para recibir los dos movimientos.' }] };
  }
  const reference = faceMetrics(selfieFace?.landmarks);
  const resultados = retos.map((reto, index) => {
    const frame = frameFaces[index];
    let detalle;
    if (frameFaces.length !== retos.length) detalle = 'Debes enviar una captura por cada movimiento solicitado.';
    else if (!reference || !validDescriptor(selfieFace) || selfieFace.faces !== 1) detalle = 'Toma una selfie de frente donde solo aparezcas tú.';
    else if (!frame || frame.faces !== 1 || !validDescriptor(frame) || !faceMetrics(frame.landmarks)) detalle = 'No encontramos un único rostro visible en la captura del movimiento.';
    else if (compareFaces(selfieFace.descriptor, frame.descriptor).distancia > FACE_DOUBTFUL_DISTANCE) detalle = 'El rostro del movimiento no coincide con el de tu selfie.';
    else if (!checkChallenge(reto, reference, faceMetrics(frame.landmarks))) detalle = 'No detectamos el movimiento solicitado; repítelo mirando primero de frente.';
    return { reto, ok: !detalle, detalle: `${LABELS[reto]}: ${detalle || 'movimiento comprobado.'}` };
  });
  return { superada: resultados.every((result) => result.ok), resultados };
}

module.exports = { CHALLENGES, generateChallenges, faceMetrics, checkChallenge, evaluateLiveness };
