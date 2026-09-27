const { Document, CreditApplication, InvestmentApplication } = require('../models');
const { resolveDocumentPath } = require('../services/storage/documentStorage');

// Una solicitud aprobada o rechazada ya no recibe documentos
const CLOSED_STATUSES = ['APROBADA', 'RECHAZADA'];
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../utils/auditLogger');

/**
 * Carga de documento asociado a una solicitud (CLIENTE)
 */
async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return errorResponse(res, 'No se ha proporcionado ningún archivo para subir.', 400);
    }

    const { tipo, creditApplicationId, investmentApplicationId } = req.body;

    const validTypes = ['CEDULA', 'COMPROBANTE_DOMICILIO', 'COMPROBANTE_INGRESOS', 'SELFIE', 'OTRO'];
    if (!validTypes.includes(tipo)) {
      return errorResponse(res, `Tipo de documento inválido. Opciones: ${validTypes.join(', ')}`, 400);
    }

    // Validar existencia de solicitud y pertenencia
    let application;
    if (creditApplicationId) {
      application = await CreditApplication.findByPk(creditApplicationId);
      if (!application) return errorResponse(res, 'Solicitud de crédito no encontrada.', 404);
    } else if (investmentApplicationId) {
      application = await InvestmentApplication.findByPk(investmentApplicationId);
      if (!application) return errorResponse(res, 'Solicitud de inversión no encontrada.', 404);
    } else {
      return errorResponse(res, 'Debe asociar el documento a una solicitud de crédito o inversión.', 400);
    }

    if (req.user.rol === 'CLIENTE' && application.userId !== req.user.id) {
      return errorResponse(res, 'No tiene permiso para subir documentos a esta solicitud.', 403);
    }
    if (CLOSED_STATUSES.includes(application.estado)) {
      return errorResponse(res, 'La solicitud ya fue resuelta; no se pueden agregar documentos.', 400);
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
        nota: 'Validación biométrica simulada para fines académicos.',
      },
    });

    return successResponse(
      res,
      { document: doc },
      200,
      'Estado del documento actualizado exitosamente (Validación biométrica simulada).'
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
