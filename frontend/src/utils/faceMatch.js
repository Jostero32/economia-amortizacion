// Reconocimiento facial en el navegador con face-api (TensorFlow.js). Los modelos se sirven desde
// public/models/face-api y la librería se carga bajo demanda para no pesar en el bundle principal.

const MODELS_URL = `${import.meta.env.BASE_URL}models/face-api`;

// Umbrales de distancia euclidiana entre descriptores. El habitual de face-api es 0.6, pero entre
// personas distintas de rasgos parecidos aparecen distancias desde ~0.47: solo se da por coincidente
// hasta 0.45 y la franja 0.45–0.60 queda para revisión manual del asesor.
export const MATCH_DISTANCE = 0.45;
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

async function blobToImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Rostro principal de una imagen: el de mayor área. La selfie se toma sosteniendo la cédula,
 * así que también aparece la foto pequeña del documento; se descarta por tamaño.
 * @returns {Promise<{descriptor: Float32Array, faces: number}|null>}
 */
export async function detectMainFace(blob) {
  const faceapi = await loadFaceApi();
  const image = await blobToImage(blob);
  const detect = (minConfidence) => faceapi
    .detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  // La foto de la cédula es pequeña: si no aparece un rostro, se reintenta con menor confianza
  let detections = await detect(0.4);
  if (!detections.length) detections = await detect(0.2);
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
// entre umbrales, ~87 % en MATCH_DISTANCE y ~13 % en DOUBTFUL_DISTANCE. Es una escala para leer la
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
