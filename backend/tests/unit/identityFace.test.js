/**
 * Pruebas Unitarias - Reconocimiento facial en el servidor (face-api con TensorFlow WASM)
 * Usa las fotos de ejemplo que trae @vladmandic/face-api: sin datos personales del proyecto.
 */
const path = require('path');
const sharp = require('sharp');
const { detectMainFace, compareFaces } = require('../../src/services/identity/faceService');

const demo = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'demo');
const crop = (file, left, top, size) => sharp(path.join(demo, file)).extract({ left, top, width: size, height: size }).jpeg().toBuffer();

jest.setTimeout(60000);

describe('Unitario: reconocimiento facial en el servidor', () => {
  let redhead;

  beforeAll(async () => {
    redhead = await crop('sample1.jpg', 1380, 170, 380);
  });

  test('detecta el rostro principal con sus 68 puntos faciales', async () => {
    const face = await detectMainFace(redhead);
    expect(face).not.toBeNull();
    expect(face.descriptor).toHaveLength(128);
    expect(face.landmarks).toHaveLength(68);
    expect(face.box.width).toBeGreaterThan(0.2);
  });

  test('encuentra el rostro aunque llene la foto (reintento con margen)', async () => {
    const tight = await sharp(redhead).extract({ left: 90, top: 70, width: 200, height: 220 }).jpeg().toBuffer();
    expect(await detectMainFace(tight)).not.toBeNull();
  });

  test('la misma persona en otra escala coincide y otra persona no', async () => {
    const reference = await detectMainFace(redhead);
    const smaller = await detectMainFace(await sharp(redhead).resize({ width: 160 }).jpeg({ quality: 70 }).toBuffer());
    const other = await detectMainFace(await crop('sample1.jpg', 360, 330, 320));

    expect(compareFaces(reference.descriptor, smaller.descriptor).resultado).toBe('COINCIDE');
    const different = compareFaces(reference.descriptor, other.descriptor);
    expect(different.resultado).toBe('NO_COINCIDE');
    expect(different.nivel).toBeLessThan(10);
  });

  test('devuelve null cuando no hay rostro', async () => {
    const blank = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#777777' } }).jpeg().toBuffer();
    expect(await detectMainFace(blank)).toBeNull();
  });
});
