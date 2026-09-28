const path = require('path');
const { FACE_MATCH_DISTANCE, FACE_DOUBTFUL_DISTANCE } = require('../../config/identity');
const { toRgb, withMargin } = require('./imageService');

/**
 * Reconocimiento facial en el servidor con face-api (TensorFlow WASM, sin compilación nativa).
 * Es el mismo motor con el que se calibraron los umbrales (tools/calibracion-identidad).
 */
let faceapi = null;
let loading = null;

function load() {
  if (!loading) {
    loading = (async () => {
      // eslint-disable-next-line global-require
      const api = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
      await api.tf.setBackend('wasm');
      await api.tf.ready();
      const models = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
      await api.nets.ssdMobilenetv1.loadFromDisk(models);
      await api.nets.faceLandmark68Net.loadFromDisk(models);
      await api.nets.faceRecognitionNet.loadFromDisk(models);
      faceapi = api;
      return api;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

/** Carga los modelos al iniciar el servidor para que la primera verificación no espere. */
const warmup = () => load();

async function detectFaces(input) {
  const api = await load();
  const { data, width, height } = await toRgb(input);
  const tensor = api.tf.tensor3d(new Uint8Array(data.buffer, data.byteOffset, data.length), [height, width, 3], 'int32');
  try {
    // La foto de la cédula es pequeña (confianza típica 0,3–0,6): se reintenta con menor confianza
    for (const minConfidence of [0.4, 0.2]) {
      const found = await api.detectAllFaces(tensor, new api.SsdMobilenetv1Options({ minConfidence }))
        .withFaceLandmarks()
        .withFaceDescriptors();
      if (found.length) {
        return { width, height, faces: found.sort((a, b) => b.detection.box.area - a.detection.box.area) };
      }
    }
    return { width, height, faces: [] };
  } finally {
    tensor.dispose();
  }
}

/**
 * Rostro principal (el de mayor área): en la selfie con la cédula en la mano se descarta la foto
 * pequeña del documento. Si no aparece, reintenta con margen (rostros que llenan la foto).
 * @returns {Promise<null | {descriptor: number[], score: number, faces: number,
 *   box: {x: number, y: number, width: number, height: number}, landmarks: {x: number, y: number}[]}>}
 *   box y landmarks en fracciones (0–1) de la imagen recibida
 */
async function detectMainFace(input) {
  let result = await detectFaces(input);
  let offset = { x: 0, y: 0 };
  let size = { width: result.width, height: result.height };
  if (!result.faces.length) {
    const padded = await withMargin(input);
    result = await detectFaces(padded.buffer);
    offset = { x: padded.offsetX, y: padded.offsetY };
    size = { width: result.width - 2 * padded.offsetX, height: result.height - 2 * padded.offsetY };
  }
  const main = result.faces[0];
  if (!main) return null;
  const { box } = main.detection;
  const relative = (x, y) => ({ x: (x - offset.x) / size.width, y: (y - offset.y) / size.height });
  const topLeft = relative(box.x, box.y);
  return {
    descriptor: Array.from(main.descriptor),
    score: main.detection.score,
    faces: result.faces.length,
    box: { x: topLeft.x, y: topLeft.y, width: box.width / size.width, height: box.height / size.height },
    landmarks: main.landmarks.positions.map((p) => relative(p.x, p.y)),
  };
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// Nivel de coincidencia (%): curva logística centrada entre los umbrales. Es una escala para leer
// la distancia, no una probabilidad.
function matchLevel(distance) {
  const midpoint = (FACE_MATCH_DISTANCE + FACE_DOUBTFUL_DISTANCE) / 2;
  return 100 / (1 + Math.exp((distance - midpoint) / 0.04));
}

/**
 * Compara dos rostros.
 * @returns {{distancia: number, nivel: number, resultado: 'COINCIDE'|'DUDOSO'|'NO_COINCIDE'}}
 */
function compareFaces(descriptorA, descriptorB) {
  const distancia = euclideanDistance(descriptorA, descriptorB);
  let resultado = 'NO_COINCIDE';
  if (distancia <= FACE_MATCH_DISTANCE) resultado = 'COINCIDE';
  else if (distancia <= FACE_DOUBTFUL_DISTANCE) resultado = 'DUDOSO';
  return {
    distancia: Math.round(distancia * 10000) / 10000,
    nivel: Math.round(matchLevel(distancia) * 100) / 100,
    resultado,
  };
}

module.exports = {
  warmup,
  detectMainFace,
  compareFaces,
  euclideanDistance,
};
