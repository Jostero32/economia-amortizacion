/** Comprobación de sharp, TensorFlow WASM y OCR sobre imágenes sintéticas o de ejemplo del paquete. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { warmup, detectMainFace } = require('../src/services/identity/faceService');
const { readMrz } = require('../src/services/identity/mrzService');

async function checkRuntime() {
  const fixture = process.argv[2];
  if (!fixture) throw new Error('Indica la ruta de tests/fixtures/mrz-sintetica.jpg (montada fuera de la imagen Docker).');
  await warmup();
  const demo = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'demo/sample1.jpg');
  const faceImage = await sharp(demo).extract({ left: 1380, top: 170, width: 380, height: 380 }).jpeg().toBuffer();
  const face = await detectMainFace(faceImage);
  assert.equal(face?.descriptor.length, 128, 'Debe detectar un rostro con descriptor completo.');
  assert.equal(face.landmarks.length, 68, 'Debe detectar los 68 puntos del rostro.');
  const mrz = await readMrz(await fs.readFile(fixture));
  assert.equal(mrz.leida, true, 'Debe leer la MRZ sintética.');
  assert.equal(mrz.consenso, true, 'Dos lecturas deben coincidir.');
  assert.equal(mrz.datos.nui, '1712345600', 'Debe recuperar el NUI de la fixture sintética.');
  assert.equal(mrz.datos.numeroDocumento, '123456789');
  console.log('sharp, reconocimiento facial con WASM y Tesseract MRZ: correctos.');
}

checkRuntime().then(() => process.exit(0)).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
