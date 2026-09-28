// Reconocimiento facial en el navegador con face-api (TensorFlow.js). Los modelos se sirven desde
// public/models/face-api y la librería se carga bajo demanda para no pesar en el bundle principal.

const MODELS_URL = `${import.meta.env.BASE_URL}models/face-api`;

// Umbrales de distancia euclidiana entre descriptores, calibrados con cédulas reales (ver
// docs/verificacion-identidad.md): cédula vs. selfie de la misma persona dio 0.42–0.45 y personas
// distintas desde 0.47 (pares muy parecidos) y 0.59 en general. Coincide hasta 0.47, por debajo de
// todo impostor observado; la franja 0.47–0.60 queda para revisión manual del asesor.
export const MATCH_DISTANCE = 0.47;
export const DOUBTFUL_DISTANCE = 0.6;

let faceapiPromise = null;

function loadFaceApi() {
  if (!faceapiPromise) {
    faceapiPromise = (async () => {
      const faceapi = await import('@vladmandic/face-api');
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
      ]);
      return faceapi;
    })().catch((error) => {
      faceapiPromise = null;
      throw error;
    });
  }
  return faceapiPromise;
}

/** Precarga la librería y los modelos (la primera vez descarga unos 12 MB). */
export const preloadFaceModels = () => loadFaceApi();

// Dibujar en un canvas aplica la orientación EXIF (las fotos de celular suelen venir rotadas)
async function blobToCanvas(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// El detector necesita contexto alrededor del rostro: en fotos donde la cara ocupa casi todo el
// cuadro (foto carnet, recortes) no la encuentra. Se reintenta con un margen gris alrededor.
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
  return canvas;
}

/**
 * Rostro principal de una imagen: el de mayor área. La selfie se toma sosteniendo la cédula,
 * así que también aparece la foto pequeña del documento; se descarta por tamaño.
 * @returns {Promise<{descriptor: Float32Array, faces: number}|null>}
 */
export async function detectMainFace(blob) {
  const faceapi = await loadFaceApi();
  const image = await blobToCanvas(blob);
  const detect = (input, minConfidence) => faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  // La foto de la cédula es pequeña (confianza típica 0.3–0.4): se reintenta con menor confianza
  // y luego con margen, para rostros que llenan la foto
  let detections = [];
  for (const input of [image, withMargin(image)]) {
    detections = await detect(input, 0.4);
    if (!detections.length) detections = await detect(input, 0.2);
    if (detections.length) break;
  }
  if (!detections.length) return null;
  const area = (detection) => detection.detection.box.width * detection.detection.box.height;
  const main = detections.reduce((best, current) => (area(current) > area(best) ? current : best));
  return { descriptor: main.descriptor, faces: detections.length };
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// Nivel de coincidencia (%) a partir de la distancia con una curva logística: 50 % en el punto medio
// entre umbrales, ~84 % en MATCH_DISTANCE y ~16 % en DOUBTFUL_DISTANCE. Es una escala para leer la
// distancia, no una probabilidad. (La similitud coseno no sirve: da 85–90 % aun entre personas distintas.)
function matchLevel(distance) {
  const midpoint = (MATCH_DISTANCE + DOUBTFUL_DISTANCE) / 2;
  const steepness = 0.04;
  return 100 / (1 + Math.exp((distance - midpoint) / steepness));
}

/**
 * Compara el rostro de la cédula con el de la selfie.
 * @returns {{ similitud: number, distancia: number, resultado: 'COINCIDE'|'DUDOSO'|'NO_COINCIDE' }}
 *   similitud: nivel de coincidencia en %; distancia euclidiana entre descriptores (menor = más parecidos)
 */
export function compareDescriptors(cedulaDescriptor, selfieDescriptor) {
  const distancia = euclideanDistance(cedulaDescriptor, selfieDescriptor);
  const similitud = matchLevel(distancia);
  let resultado = 'NO_COINCIDE';
  if (distancia <= MATCH_DISTANCE) resultado = 'COINCIDE';
  else if (distancia <= DOUBTFUL_DISTANCE) resultado = 'DUDOSO';
  return {
    similitud: Math.round(similitud * 100) / 100,
    distancia: Math.round(distancia * 10000) / 10000,
    resultado,
  };
}
