// Controles de calidad de la captura en el navegador. Son orientativos: el servidor vuelve a
// analizar las imágenes y es quien decide.

// Proporción de la cédula (formato ID-1: 85,6 × 54 mm)
export const CARD_RATIO = 1.586;

// Nitidez mínima de la franja MRZ para que el servidor la lea con confianza (calibrada en la fase 0)
export const MIN_BACK_SHARPNESS = 40;
// El anverso solo necesita un rostro reconocible: se exige menos
export const MIN_FRONT_SHARPNESS = 15;

/**
 * Región del video (en pixeles del video) que se ve dentro del contenedor con object-fit: cover.
 * Con un contenedor de proporción fija, la cámara puede ser vertical (celular) u horizontal (laptop).
 * @param {{x: number, y: number, width: number, height: number}} [part] - Parte del contenedor, en fracciones
 */
export function visibleRegion(video, container, part = { x: 0, y: 0, width: 1, height: 1 }) {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const scale = Math.max(cw / video.videoWidth, ch / video.videoHeight);
  const visibleWidth = cw / scale;
  const visibleHeight = ch / scale;
  const x0 = (video.videoWidth - visibleWidth) / 2;
  const y0 = (video.videoHeight - visibleHeight) / 2;
  return {
    x: x0 + part.x * visibleWidth,
    y: y0 + part.y * visibleHeight,
    width: part.width * visibleWidth,
    height: part.height * visibleHeight,
  };
}

/** Copia una región del video (en pixeles del video) a un canvas, a resolución completa. */
export function grabFrame(video, region = null) {
  const r = region || { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(r.width);
  canvas.height = Math.round(r.height);
  canvas.getContext('2d').drawImage(video, r.x, r.y, r.width, r.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Copia reducida (para analizar rápido) conservando la proporción. */
export function scaled(source, width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((source.height / source.width) * width);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function grayPixels(canvas) {
  const { data } = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Float32Array(canvas.width * canvas.height);
  for (let i = 0; i < gray.length; i += 1) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return gray;
}

/**
 * Nitidez: varianza del Laplaciano con la imagen a 800 px de ancho, en la franja vertical indicada
 * (misma medida que el servidor; mayor = más nítida).
 */
export function sharpness(source, { from = 0, to = 1 } = {}) {
  const canvas = scaled(source, 800);
  const gray = grayPixels(canvas);
  const w = canvas.width;
  const y0 = Math.max(1, Math.round(canvas.height * from));
  const y1 = Math.min(canvas.height - 1, Math.round(canvas.height * to));
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const lap = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      sum += lap;
      sum2 += lap * lap;
      n += 1;
    }
  }
  return n ? sum2 / n - (sum / n) ** 2 : 0;
}

/** Brillo promedio (0–255) de una imagen. */
export function brightness(source) {
  const gray = grayPixels(scaled(source, 160));
  return gray.reduce((total, value) => total + value, 0) / gray.length;
}

export function lightingProblem(value) {
  if (value < 55) return 'Hay poca luz: acércate a una ventana o enciende una lámpara.';
  if (value > 235) return 'Hay demasiada luz o un reflejo: inclina un poco la cédula.';
  return null;
}

/** JPEG listo para subir. */
export function canvasToFile(canvas, name, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('No se pudo generar la foto.'));
      else resolve(new File([blob], `${name}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', quality);
  });
}
