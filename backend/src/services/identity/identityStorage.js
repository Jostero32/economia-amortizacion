const fs = require('fs');
const path = require('path');
const { DOCUMENTS_DIR } = require('../storage/documentStorage');

/**
 * Capturas de la verificación de identidad: carpeta privada (nunca publicada como estático),
 * una subcarpeta por verificación. Se entregan solo por el endpoint con control de acceso.
 */
const IDENTITY_DIR = path.join(DOCUMENTS_DIR, 'identidad');

/**
 * Guarda una imagen JPEG y devuelve su ruta relativa (lo que se guarda en la base de datos).
 * Cada captura lleva la hora: los reintentos no pisan las anteriores y quedan como evidencia.
 */
async function saveImage(verificationId, name, buffer) {
  const dir = path.join(IDENTITY_DIR, verificationId);
  await fs.promises.mkdir(dir, { recursive: true });
  const fileName = `${name}-${Date.now()}.jpg`;
  await fs.promises.writeFile(path.join(dir, fileName), buffer);
  return `${verificationId}/${fileName}`;
}

/** Ruta física de una captura, o null si no existe o intenta salir de la carpeta. */
function resolveImage(relativePath) {
  if (!relativePath) return null;
  const fullPath = path.resolve(IDENTITY_DIR, relativePath);
  if (!fullPath.startsWith(IDENTITY_DIR + path.sep)) return null;
  return fs.existsSync(fullPath) ? fullPath : null;
}

async function readImage(relativePath) {
  const fullPath = resolveImage(relativePath);
  return fullPath ? fs.promises.readFile(fullPath) : null;
}

module.exports = {
  IDENTITY_DIR,
  saveImage,
  resolveImage,
  readImage,
};
