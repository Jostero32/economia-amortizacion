// Detección de rostros en el navegador con face-api (TensorFlow.js), solo para GUIAR la captura
// (rostro visible, centrado y de buen tamaño). La comparación que decide se calcula en el servidor
// con los umbrales de backend/src/config/identity.js. Los modelos se sirven desde
// public/models/face-api y la librería se carga bajo demanda para no pesar en el bundle principal.

const MODELS_URL = `${import.meta.env.BASE_URL}models/face-api`;

let faceapiPromise = null;

function loadFaceApi() {
  if (!faceapiPromise) {
    faceapiPromise = (async () => {
      const faceapi = await import('@vladmandic/face-api');
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      ]);
      return faceapi;
    })().catch((error) => {
      faceapiPromise = null;
      throw error;
    });
  }
  return faceapiPromise;
}

/** Precarga la librería y los modelos (la primera vez descarga unos 6 MB). */
export const preloadFaceModels = () => loadFaceApi();

// El detector necesita contexto alrededor del rostro: en fotos donde la cara ocupa casi todo el
// cuadro no la encuentra. Se reintenta con un margen gris alrededor.
function withMargin(source, ratio = 0.35) {
  const canvas = document.createElement('canvas');
  const dx = Math.round(source.width * ratio);
  const dy = Math.round(source.height * ratio);
  canvas.width = source.width + 2 * dx;
  canvas.height = source.height + 2 * dy;
  const context = canvas.getContext('2d');
  context.fillStyle = '#808080';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, dx, dy);
  return { canvas, dx, dy };
}

/**
 * Rostro principal (el de mayor área) de un canvas.
 * @returns {Promise<null | {score: number, faces: number, box: {x, y, width, height},
 *   landmarks: {x: number, y: number}[]}>} caja y puntos en fracciones (0–1) del canvas
 */
export async function detectFaceInCanvas(canvas, { allowMargin = false } = {}) {
  const faceapi = await loadFaceApi();
  const detect = (input, minConfidence) => faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence }))
    .withFaceLandmarks();

  let detections = await detect(canvas, 0.4);
  if (!detections.length) detections = await detect(canvas, 0.2);
  let offset = { dx: 0, dy: 0 };
  if (!detections.length && allowMargin) {
    const padded = withMargin(canvas);
    detections = await detect(padded.canvas, 0.2);
    offset = padded;
  }
  if (!detections.length) return null;

  const area = (d) => d.detection.box.width * d.detection.box.height;
  const main = detections.reduce((best, current) => (area(current) > area(best) ? current : best));
  const toRelative = (x, y) => ({ x: (x - offset.dx) / canvas.width, y: (y - offset.dy) / canvas.height });
  const { box } = main.detection;
  const topLeft = toRelative(box.x, box.y);
  return {
    score: main.detection.score,
    faces: detections.length,
    box: { x: topLeft.x, y: topLeft.y, width: box.width / canvas.width, height: box.height / canvas.height },
    landmarks: main.landmarks.positions.map((p) => toRelative(p.x, p.y)),
  };
}
