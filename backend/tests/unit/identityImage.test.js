/**
 * Pruebas Unitarias - Imágenes de la verificación de identidad (orientación, recorte y nitidez)
 */
const sharp = require('sharp');
const { normalizeImage, cropCard, sharpness } = require('../../src/services/identity/imageService');

// Tarjeta clara (proporción de una cédula) sobre un fondo oscuro, como una foto sobre una mesa
async function cardOnTable() {
  const card = await sharp({ create: { width: 856, height: 540, channels: 3, background: '#dfe8ef' } }).png().toBuffer();
  return sharp({ create: { width: 1400, height: 1000, channels: 3, background: '#5a3b24' } })
    .composite([{ input: card, left: 272, top: 230 }])
    .jpeg()
    .toBuffer();
}

// Patrón de franjas finas (texto nítido) en la zona inferior
async function stripes({ blur = 0 } = {}) {
  const width = 800;
  const height = 500;
  const pixels = Buffer.alloc(width * height * 3, 230);
  for (let y = Math.round(height * 0.65); y < height * 0.95; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (Math.floor(x / 3) % 2 === 0) pixels.fill(20, (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
  }
  let image = sharp(pixels, { raw: { width, height, channels: 3 } });
  if (blur) image = image.blur(blur);
  return image.jpeg().toBuffer();
}

describe('Unitario: imágenes de la verificación de identidad', () => {
  test('normalizeImage aplica la orientación EXIF y limita el tamaño', async () => {
    // Guardada de lado (orientación 6: hay que girarla 90°), como sale de muchos celulares
    const rotated = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#cccccc' } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const result = await normalizeImage(rotated);
    expect(result.height).toBeGreaterThan(result.width);
    expect(Math.max(result.width, result.height)).toBe(1600);
  });

  test('normalizeImage rechaza un archivo que no es una imagen', async () => {
    await expect(normalizeImage(Buffer.from('no es una imagen'))).rejects.toMatchObject({ statusCode: 400 });
  });

  test('cropCard recorta la cédula cuando la foto trae fondo', async () => {
    const result = await cropCard(await cardOnTable());
    expect(result.cropped).toBe(true);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width / meta.height).toBeCloseTo(856 / 540, 1);
    expect(Math.abs(meta.width - 856)).toBeLessThanOrEqual(12);
  });

  test('cropCard conserva la imagen cuando ya es solo la tarjeta', async () => {
    const onlyCard = await sharp({ create: { width: 856, height: 540, channels: 3, background: '#dfe8ef' } }).jpeg().toBuffer();
    expect((await cropCard(onlyCard)).cropped).toBe(false);
  });

  test('sharpness distingue una franja nítida de una desenfocada', async () => {
    const sharpValue = await sharpness(await stripes());
    const blurredValue = await sharpness(await stripes({ blur: 3 }));
    expect(sharpValue).toBeGreaterThan(40);
    expect(blurredValue).toBeLessThan(sharpValue / 4);
  });
});
