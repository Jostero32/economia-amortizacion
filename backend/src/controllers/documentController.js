const fs = require('fs');
const { Document, CreditApplication, InvestmentApplication } = require('../models');
const { resolveDocumentPath } = require('../services/storage/documentStorage');

// Una solicitud aprobada o rechazada ya no recibe documentos
const CLOSED_STATUSES = ['APROBADA', 'RECHAZADA'];
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../utils/auditLogger');

// El asesor compara el rostro de la cédula con el de la selfie: ambas deben ser imágenes
const FACE_DOCUMENT_TYPES = ['CEDULA', 'SELFIE'];
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Carga de documento asociado a una solicitud (CLIENTE)
 */
async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return errorResponse(res, 'No se ha proporcionado ningún archivo para subir.', 400);
    }

    const { tipo, creditApplicationId, investmentApplicationId } = req.body;

    // Un archivo rechazado no debe quedar en el disco
    const reject = (message, status = 400) => {
      fs.unlink(req.file.path, () => {});
      return errorResponse(res, message, status);
    };

    const validTypes = ['CEDULA', 'COMPROBANTE_DOMICILIO', 'COMPROBANTE_INGRESOS', 'SELFIE', 'POLIZA_DESGRAVAMEN', 'OTRO'];
    if (!validTypes.includes(tipo)) {
      return reject(`Tipo de documento inválido. Opciones: ${validTypes.join(', ')}`);
    }
    if (FACE_DOCUMENT_TYPES.includes(tipo) && !IMAGE_MIMES.includes(req.file.mimetype)) {
      return reject('La cédula y la selfie deben ser una foto JPG, PNG o WEBP (no PDF) para la validación biométrica.');
    }
    // Dato biométrico (LOPDP): requiere autorización expresa del titular
    const consentimientoBiometrico = String(req.body.consentimientoBiometrico) === 'true';
    if (tipo === 'SELFIE' && !consentimientoBiometrico) {
      return reject('Debes autorizar el tratamiento de tu imagen para la validación biométrica.');
    }

    // Validar existencia de solicitud y pertenencia
    let application;
    if (creditApplicationId) {
      application = await CreditApplication.findByPk(creditApplicationId);
      if (!application) return reject('Solicitud de crédito no encontrada.', 404);
    } else if (investmentApplicationId) {
      application = await InvestmentApplication.findByPk(investmentApplicationId);
      if (!application) return reject('Solicitud de inversión no encontrada.', 404);
    } else {
      return reject('Debe asociar el documento a una solicitud de crédito o inversión.');
    }

    if (req.user.rol === 'CLIENTE' && application.userId !== req.user.id) {
      return reject('No tiene permiso para subir documentos a esta solicitud.', 403);
    }
    if (CLOSED_STATUSES.includes(application.estado)) {
      return reject('La solicitud ya fue resuelta; no se pueden agregar documentos.');
    }

    const doc = await Document.create({
      creditApplicationId: creditApplicationId || null,
      investmentApplicationId: investmentApplicationId || null,
      tipo,
      nombreArchivo: req.file.originalname,
      ruta: req.file.filename,
      mimeType: req.file.mimetype,
      tamano: req.file.size,
      estado: 'PENDIENTE',
      fechaSubida: new Date(),
    });

    await logAudit({
      req,
      accion: 'SUBIR_DOCUMENTO',
      entidad: 'Document',
      entidadId: doc.id,
      detalles: {
        tipo,
        nombreArchivo: req.file.originalname,
        tamano: req.file.size,
        ...(tipo === 'SELFIE' ? { consentimientoBiometrico } : {}),
      },
    });

    return successResponse(res, { document: doc }, 201, 'Documento cargado correctamente.');
  } catch (error) {
    next(error);
  }
}

/**
 * Descargar / Ver archivo de documento
 */
async function getDocumentFile(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await Document.findByPk(id, {
      include: [
        { model: CreditApplication, as: 'creditApplication', attributes: ['userId'] },
        { model: InvestmentApplication, as: 'investmentApplication', attributes: ['userId'] },
      ],
    });

    if (!doc) {
      return errorResponse(res, 'Documento no encontrado.', 404);
    }

    // Un cliente solo puede ver los documentos de sus propias solicitudes
    if (req.user.rol === 'CLIENTE') {
      const ownerId = doc.creditApplication?.userId || doc.investmentApplication?.userId;
      if (ownerId !== req.user.id) {
        return errorResponse(res, 'No tiene permiso para ver este documento.', 403);
      }
    }

    const filePath = resolveDocumentPath(doc.ruta);
    if (!filePath) {
      return errorResponse(res, 'El archivo físico no se encuentra en el servidor.', 404);
    }

    res.setHeader('Content-Type', doc.mimeType);
    return res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
}

/**
 * Listado de documentos para revisión de Asesor / Admin
 */
async function getAllDocuments(req, res, next) {
  try {
    const documents = await Document.findAll({
      include: [
        { model: CreditApplication, as: 'creditApplication' },
        { model: InvestmentApplication, as: 'investmentApplication' },
      ],
      order: [['createdAt', 'DESC']],
    });

    return successResponse(res, { documents });
  } catch (error) {
    next(error);
  }
}

/**
 * Actualizar estado de documento / Validación Biométrica Simulada (ASESOR / ADMIN)
 */
async function updateDocumentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { estado, comentarioRevision } = req.body;

    const validStates = ['PENDIENTE', 'VALIDADO', 'RECHAZADO'];
    if (!validStates.includes(estado)) {
      return errorResponse(res, `Estado inválido. Opciones permitidas: ${validStates.join(', ')}`, 400);
    }

    // El cliente necesita saber qué corregir para volver a subir el documento
    if (estado === 'RECHAZADO' && !String(comentarioRevision || '').trim()) {
      return errorResponse(
        res,
        'Indica el motivo del rechazo para que el cliente pueda corregir el documento.',
        400,
        { comentarioRevision: 'El motivo del rechazo es obligatorio.' }
      );
    }

    const doc = await Document.findByPk(id);
    if (!doc) {
      return errorResponse(res, 'Documento no encontrado.', 404);
    }

    doc.estado = estado;
    if (comentarioRevision !== undefined) {
      doc.comentarioRevision = comentarioRevision;
    }
    doc.revisadoPor = req.user.id;
    await doc.save();

    await logAudit({
      req,
      accion: 'VALIDAR_DOCUMENTO',
      entidad: 'Document',
      entidadId: doc.id,
      detalles: {
        tipo: doc.tipo,
        estado,
        comentarioRevision,
      },
    });

    return successResponse(
      res,
      { document: doc },
      200,
      'Estado del documento actualizado exitosamente.'
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadDocument,
  getDocumentFile,
  getAllDocuments,
  updateDocumentStatus,
};
