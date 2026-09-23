const path = require('path');
const fs = require('fs');
const { Document, CreditApplication, InvestmentApplication } = require('../models');
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
    if (creditApplicationId) {
      const app = await CreditApplication.findByPk(creditApplicationId);
      if (!app) return errorResponse(res, 'Solicitud de crédito no encontrada.', 404);
      if (req.user.rol === 'CLIENTE' && app.userId !== req.user.id) {
        return errorResponse(res, 'No tiene permiso para subir documentos a esta solicitud.', 403);
      }
    } else if (investmentApplicationId) {
      const app = await InvestmentApplication.findByPk(investmentApplicationId);
      if (!app) return errorResponse(res, 'Solicitud de inversión no encontrada.', 404);
      if (req.user.rol === 'CLIENTE' && app.userId !== req.user.id) {
        return errorResponse(res, 'No tiene permiso para subir documentos a esta solicitud.', 403);
      }
    } else {
      return errorResponse(res, 'Debe asociar el documento a una solicitud de crédito o inversión.', 400);
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
    const doc = await Document.findByPk(id);

    if (!doc) {
      return errorResponse(res, 'Documento no encontrado.', 404);
    }

    const filePath = path.resolve(__dirname, '../../uploads', doc.ruta);
    if (!fs.existsSync(filePath)) {
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
