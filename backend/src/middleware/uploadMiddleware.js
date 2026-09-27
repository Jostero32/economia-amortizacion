const multer = require('multer');
const path = require('path');
const { UPLOADS_DIR, DOCUMENTS_DIR } = require('../services/storage/documentStorage');

function buildFileName(req, file, cb) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(file.originalname).toLowerCase();
  const cleanBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  cb(null, `${cleanBaseName}-${uniqueSuffix}${ext}`);
}

// Documentos de solicitudes: carpeta privada, no publicada como estático
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCUMENTS_DIR),
  filename: buildFileName,
});

// Logotipo institucional: carpeta pública /uploads
const publicStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: buildFileName,
});

// Filtro de extensiones y tipos MIME permitidos
const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Tipo de archivo no permitido. Solo se aceptan archivos PDF o imágenes JPG/PNG/WEBP.');
    error.statusCode = 400;
    cb(error, false);
  }
}

function imageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const imageMimes = ['image/jpeg', 'image/png'];
  const imageExts = ['.jpg', '.jpeg', '.png'];

  if (imageMimes.includes(file.mimetype) && imageExts.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error('El logotipo debe ser una imagen JPG o PNG.');
    error.statusCode = 400;
    cb(error, false);
  }
}

// Límite de 5 MB por archivo
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Megabytes
  },
});

const imageUpload = multer({
  storage: publicStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = upload;
module.exports.imageUpload = imageUpload;
