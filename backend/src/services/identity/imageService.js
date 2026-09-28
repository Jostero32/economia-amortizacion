const sharp = require('sharp');
const { MAX_IMAGE_SIDE } = require('../../config/identity');
const { httpError } = require('../../utils/httpError');

/**
 * Normaliza una foto recibida: aplica la orientación EXIF (las fotos de celular suelen venir
 * rotadas), limita el lado mayor y la guarda como JPEG.
 * @returns {Promise<{buffer: Buffer, width: number, height: number}>}
 */
async function normalizeImage(input) {
  try {
    const { data, info } = await sharp(input)
      .rotate()
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch {
    throw httpError('No pudimos leer la imagen. Toma la foto de nuevo o sube un archivo JPG o PNG.', 400);
  }
}

/** Pixeles RGB (3 canales) de una imagen, listos para TensorFlow. */
async function toRgb(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels === 3) return { data, width: info.width, height: info.height };
  const rgb = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0; i < info.width * info.height; i += 1) rgb.fill(data[i * info.channels], i * 3, i * 3 + 3);
  return { data: rgb, width: info.width, height: info.height };
}

/** Agrega un margen gris: el detector necesita contexto cuando el rostro llena la foto. */
async function withMargin(input, ratio = 0.35) {
  const meta = await sharp(input).metadata();
  const dx = Math.round(meta.width * ratio);
  const dy = Math.round(meta.height * ratio);
  const buffer = await sharp(input)
    .extend({ top: dy, bottom: dy, left: dx, right: dx, background: '#808080' })
    .jpeg({ quality: 92 })
    .toBuffer();
  return { buffer, offsetX: dx, offsetY: dy };
}

/**
 * Caja de la tarjeta dentro de la foto: el mayor componente claro (la cédula es clara sobre la
 * mayoría de fondos). Se analiza a 320 px de ancho para que sea rápido.
 * @returns {Promise<{left: number, top: number, width: number, height: number}>}
 */
async function detectCardBox(input) {
  const meta = await sharp(input).metadata();
  const { data, info } = await sharp(input).greyscale().resize({ width: 320 }).blur(1.5).raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const mask = new Uint8Array(w * h);
  // Claro y dilatado 3x3 para cerrar los huecos del texto impreso
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      let bright = 0;
      for (let dy = -1; dy <= 1 && !bright; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (data[(y + dy) * w + x + dx] > 150) { bright = 1; break; }
        }
      }
      mask[y * w + x] = bright;
    }
  }
  const seen = new Uint8Array(w * h);
  let best = null;
  for (let start = 0; start < w * h; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    const box = { n: 0, x0: w, y0: h, x1: 0, y1: 0 };
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      box.n += 1;
      box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
      box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q >= 0 && q < w * h && mask[q] && !seen[q] && Math.abs((q % w) - x) <= 1) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (!best || box.n > best.n) best = box;
  }
  if (!best) return { left: 0, top: 0, width: meta.width, height: meta.height };
  const k = meta.width / w;
  const left = Math.max(0, Math.round(best.x0 * k));
  const top = Math.max(0, Math.round(best.y0 * k));
  return {
    left,
    top,
    width: Math.min(meta.width - left, Math.round((best.x1 - best.x0 + 1) * k)),
    height: Math.min(meta.height - top, Math.round((best.y1 - best.y0 + 1) * k)),
  };
}

/**
 * Recorta la cédula cuando la foto trae fondo (por ejemplo, subida desde la galería). Si la caja
 * detectada no tiene forma de tarjeta, se conserva la imagen completa.
 * @returns {Promise<{buffer: Buffer, cropped: boolean}>}
 */
async function cropCard(input) {
  const meta = await sharp(input).metadata();
  const box = await detectCardBox(input);
  const ratio = box.width / box.height;
  const coverage = (box.width * box.height) / (meta.width * meta.height);
  if (coverage > 0.85 || coverage < 0.15 || ratio < 1.3 || ratio > 1.9) {
    return { buffer: input, cropped: false };
  }
  const buffer = await sharp(input).extract(box).jpeg({ quality: 92 }).toBuffer();
  return { buffer, cropped: true };
}

/**
 * Nitidez: varianza del Laplaciano con la tarjeta llevada a 800 px de ancho, en la franja vertical
 * indicada (por defecto, la zona MRZ del reverso). Mayor = más nítida.
 */
async function sharpness(input, { from = 0.62, to = 0.97 } = {}) {
  const { data, info } = await sharp(input).resize({ width: 800 }).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const y0 = Math.max(1, Math.round(info.height * from));
  const y1 = Math.min(info.height - 1, Math.round(info.height * to));
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const lap = data[i - 1] + data[i + 1] + data[i - w] + data[i + w] - 4 * data[i];
      sum += lap;
      sum2 += lap * lap;
      n += 1;
    }
  }
  return n ? sum2 / n - (sum / n) ** 2 : 0;
}

module.exports = {
  normalizeImage,
  toRgb,
  withMargin,
  detectCardBox,
  cropCard,
  sharpness,
};
