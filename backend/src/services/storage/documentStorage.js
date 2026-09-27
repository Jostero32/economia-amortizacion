const fs = require('fs');
const path = require('path');

/**
 * Ubicación de archivos subidos.
 *
 * - UPLOADS_DIR: solo su primer nivel se publica en /uploads (logotipo institucional).
 * - DOCUMENTS_DIR: documentos de las solicitudes (cédula, selfie, comprobantes). Nunca se
 *   sirven de forma estática; se entregan por /api/documents/:id con control de acceso.
 */
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');
const DOCUMENTS_DIR = path.join(UPLOADS_DIR, 'documentos');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Ruta física de un documento. Incluye la ubicación anterior (raíz de uploads)
 * para documentos subidos antes de separar la carpeta privada.
 * @param {string} ruta - Nombre del archivo guardado en Document.ruta
 * @returns {string|null}
 */
function resolveDocumentPath(ruta) {
  const fileName = path.basename(String(ruta || ''));
  if (!fileName) return null;

  const privatePath = path.join(DOCUMENTS_DIR, fileName);
  if (fs.existsSync(privatePath)) return privatePath;

  const legacyPath = path.join(UPLOADS_DIR, fileName);
  if (fs.existsSync(legacyPath)) return legacyPath;

  return null;
}

/**
 * Mueve a la carpeta privada los documentos que quedaron en la raíz pública de uploads.
 * @param {import('sequelize').ModelStatic<any>} Document
 * @returns {Promise<number>} Cantidad de archivos movidos
 */
async function moveLegacyDocuments(Document) {
  ensureDir(DOCUMENTS_DIR);
  const documents = await Document.findAll({ attributes: ['ruta'] });

  let moved = 0;
  for (const { ruta } of documents) {
    const fileName = path.basename(String(ruta || ''));
    if (!fileName) continue;

    const legacyPath = path.join(UPLOADS_DIR, fileName);
    const privatePath = path.join(DOCUMENTS_DIR, fileName);
    if (fs.existsSync(legacyPath) && !fs.existsSync(privatePath)) {
      fs.renameSync(legacyPath, privatePath);
      moved += 1;
    }
  }
  return moved;
}

ensureDir(DOCUMENTS_DIR);

module.exports = {
  UPLOADS_DIR,
  DOCUMENTS_DIR,
  resolveDocumentPath,
  moveLegacyDocuments,
};
