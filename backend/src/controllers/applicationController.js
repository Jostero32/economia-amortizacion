const {
  CreditApplication,
  InvestmentApplication,
  CreditSimulation,
  InvestmentSimulation,
  CreditType,
  InvestmentProduct,
  Document,
  User,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../utils/auditLogger');
const { calculateInvestment } = require('../services/investment/calculator');

function generateApplicationCode(prefix) {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}-${randomSuffix}`;
}

const REQUIRED_DOCUMENT_TYPES = [
  'CEDULA',
  'COMPROBANTE_DOMICILIO',
  'COMPROBANTE_INGRESOS',
  'SELFIE',
];

const DOCUMENT_TYPE_LABELS = {
  CEDULA: 'cédula de identidad',
  COMPROBANTE_DOMICILIO: 'comprobante de domicilio',
  COMPROBANTE_INGRESOS: 'comprobante de ingresos',
  SELFIE: 'selfie para validación biométrica',
};

/**
 * Crear solicitud de crédito (CLIENTE)
 */
async function createCreditApplication(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      simulationId,
      creditTypeId,
      monto,
      plazoMeses,
      sistemaAmortizacion,
      nombres,
      apellidos,
      cedula,
      fechaNacimiento,
      estadoCivil,
      direccion,
      ciudad,
      telefono,
      email,
      actividadEconomica,
      ingresosMensuales,
      egresosMensuales,
    } = req.body;

    let simulation = null;
    let tasaAplicada = 0;
    let cuotaEstimada = 0;

    if (simulationId) {
      simulation = await CreditSimulation.findByPk(simulationId);
      if (simulation) {
        tasaAplicada = simulation.tasaAnual;
        cuotaEstimada = simulation.cuotaInicial;
      }
    }

    if (!simulation) {
      const product = await CreditType.findByPk(creditTypeId);
      if (!product || !product.activo) {
        return errorResponse(res, 'Producto de crédito no válido.', 404);
      }
      tasaAplicada = product.tasaInstitucion;
      cuotaEstimada = Number(monto) / Number(plazoMeses);
    }

    const applicationCode = generateApplicationCode('SOL-CRE');

    const application = await CreditApplication.create({
      codigo: applicationCode,
      userId,
      simulationId: simulationId || null,
      creditTypeId,
      monto: Number(monto),
      plazoMeses: parseInt(plazoMeses, 10),
      sistemaAmortizacion: (sistemaAmortizacion || 'FRANCES').toUpperCase(),
      tasaAplicada,
      cuotaEstimada,
      estado: 'PENDIENTE',
      nombres,
      apellidos,
      cedula,
      fechaNacimiento: fechaNacimiento || null,
      estadoCivil: estadoCivil || null,
      direccion,
      ciudad,
      telefono,
      email,
      actividadEconomica: actividadEconomica || null,
      ingresosMensuales: Number(ingresosMensuales),
      egresosMensuales: Number(egresosMensuales),
      biometriaValidada: false,
    });

    await logAudit({
      req,
      accion: 'CREAR_SOLICITUD',
      entidad: 'CreditApplication',
      entidadId: application.id,
      detalles: { codigo: application.codigo, monto, plazoMeses },
    });

    return successResponse(res, { application }, 201, 'Solicitud de crédito ingresada exitosamente.');
  } catch (error) {
    next(error);
  }
}

/**
 * Obtener solicitudes de crédito del cliente autenticado
 */
async function getMyCreditApplications(req, res, next) {
  try {
    const applications = await CreditApplication.findAll({
      where: { userId: req.user.id },
      include: [
        { model: CreditType, as: 'creditType' },
        { model: Document, as: 'documents' },
        { model: CreditSimulation, as: 'simulation' },
      ],
      order: [['createdAt', 'DESC']],
    });

    return successResponse(res, { applications });
  } catch (error) {
    next(error);
  }
}

/**
 * Obtener detalle de solicitud de crédito
 */
async function getCreditApplicationById(req, res, next) {
  try {
    const { id } = req.params;
    const application = await CreditApplication.findByPk(id, {
      include: [
        { model: CreditType, as: 'creditType' },
        { model: Document, as: 'documents' },
        { model: CreditSimulation, as: 'simulation' },
        { model: User, as: 'user', attributes: ['id', 'nombre', 'email', 'rol'] },
        { model: User, as: 'asesor', attributes: ['id', 'nombre', 'email'] },
      ],
    });

    if (!application) {
      return errorResponse(res, 'Solicitud de crédito no encontrada.', 404);
    }

    // Si es cliente, verificar que sea el propietario
    if (req.user.rol === 'CLIENTE' && application.userId !== req.user.id) {
      return errorResponse(res, 'No tiene permiso para ver esta solicitud.', 403);
    }

    return successResponse(res, { application });
  } catch (error) {
    next(error);
  }
}

/**
 * Crear solicitud de inversión (CLIENTE)
 */
async function createInvestmentApplication(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      simulationId,
      investmentProductId,
      monto,
      plazoDias,
      nombres,
      apellidos,
      cedula,
      telefono,
      email,
      actividadEconomica,
      ingresosMensuales,
      origenFondos,
      finalidadInversion,
    } = req.body;

    let simulation = null;
    let tasaAplicada = 0;
    let interesEstimado = 0;
    let valorFinalEstimado = 0;

    if (simulationId) {
      simulation = await InvestmentSimulation.findByPk(simulationId);
      if (!simulation) {
        return errorResponse(res, 'La simulación de inversión indicada no existe.', 404);
      }

      if (Number(simulation.investmentProductId) !== Number(investmentProductId)) {
        return errorResponse(res, 'El producto no corresponde a la simulación de inversión.', 400);
      }

      if (Number(simulation.monto) !== Number(monto) || Number(simulation.plazoDias) !== Number(plazoDias)) {
        return errorResponse(res, 'El monto o plazo no corresponde a la simulación de inversión.', 400);
      }

      tasaAplicada = simulation.tasaAnual;
      interesEstimado = simulation.interesGanado;
      valorFinalEstimado = simulation.valorFinal;
    }

    if (!simulation) {
      const product = await InvestmentProduct.findByPk(investmentProductId);
      if (!product || !product.activo) {
        return errorResponse(res, 'Producto de inversión no válido.', 404);
      }

      if (Number(monto) < Number(product.montoMinimo) || Number(monto) > Number(product.montoMaximo)) {
        return errorResponse(res, 'El monto está fuera de los límites del producto de inversión.', 400);
      }

      if (Number(plazoDias) < product.plazoMinimoDias || Number(plazoDias) > product.plazoMaximoDias) {
        return errorResponse(res, 'El plazo está fuera de los límites del producto de inversión.', 400);
      }

      tasaAplicada = product.tasa || 5.0;
      const investmentResult = calculateInvestment({
        amount: Number(monto),
        termDays: Number(plazoDias),
        annualRate: Number(tasaAplicada),
      });
      interesEstimado = investmentResult.interesGanado;
      valorFinalEstimado = investmentResult.valorFinal;
    }

    const applicationCode = generateApplicationCode('SOL-INV');

    const application = await InvestmentApplication.create({
      codigo: applicationCode,
      userId,
      simulationId: simulationId || null,
      investmentProductId,
      monto: Number(monto),
      plazoDias: parseInt(plazoDias, 10),
      tasaAplicada,
      interesEstimado,
      valorFinalEstimado,
      estado: 'PENDIENTE',
      nombres,
      apellidos,
      cedula,
      telefono,
      email,
      actividadEconomica,
      ingresosMensuales: Number(ingresosMensuales),
      origenFondos,
      finalidadInversion,
      biometriaValidada: false,
    });

    await logAudit({
      req,
      accion: 'CREAR_SOLICITUD',
      entidad: 'InvestmentApplication',
      entidadId: application.id,
      detalles: { codigo: application.codigo, monto, plazoDias },
    });

    return successResponse(res, { application }, 201, 'Solicitud de inversión registrada con éxito.');
  } catch (error) {
    next(error);
  }
}

async function getMyInvestmentApplications(req, res, next) {
  try {
    const applications = await InvestmentApplication.findAll({
      where: { userId: req.user.id },
      include: [
        { model: InvestmentProduct, as: 'product' },
        { model: Document, as: 'documents' },
        { model: InvestmentSimulation, as: 'simulation' },
      ],
      order: [['createdAt', 'DESC']],
    });
    return successResponse(res, { applications });
  } catch (error) {
    next(error);
  }
}

async function getInvestmentApplicationById(req, res, next) {
  try {
    const { id } = req.params;
    const application = await InvestmentApplication.findByPk(id, {
      include: [
        { model: InvestmentProduct, as: 'product' },
        { model: Document, as: 'documents' },
        { model: User, as: 'user', attributes: ['id', 'nombre', 'email'] },
        { model: User, as: 'asesor', attributes: ['id', 'nombre', 'email'] },
        { model: InvestmentSimulation, as: 'simulation' },
      ],
    });

    if (!application) {
      return errorResponse(res, 'Solicitud no encontrada.', 404);
    }

    if (req.user.rol === 'CLIENTE' && application.userId !== req.user.id) {
      return errorResponse(res, 'No tiene permiso para ver esta solicitud.', 403);
    }

    return successResponse(res, { application });
  } catch (error) {
    next(error);
  }
}

/**
 * Listado de todas las solicitudes para el Asesor / Administrador
 */
async function getAllApplications(req, res, next) {
  try {
    const creditApps = await CreditApplication.findAll({
      include: [
        { model: CreditType, as: 'creditType' },
        { model: User, as: 'user', attributes: ['id', 'nombre', 'email'] },
        { model: Document, as: 'documents' },
      ],
      order: [['createdAt', 'DESC']],
    });

    const investmentApps = await InvestmentApplication.findAll({
      include: [
        { model: InvestmentProduct, as: 'product' },
        { model: User, as: 'user', attributes: ['id', 'nombre', 'email'] },
        { model: Document, as: 'documents' },
      ],
      order: [['createdAt', 'DESC']],
    });

    return successResponse(res, {
      creditApplications: creditApps,
      investmentApplications: investmentApps,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Actualizar estado de solicitud y validación biométrica (ASESOR / ADMIN)
 */
async function updateApplicationStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { estado, observacionAsesor, biometriaValidada, tipo = 'CREDITO' } = req.body;

    const validStates = ['PENDIENTE', 'EN_REVISION', 'PENDIENTE_DOCUMENTOS', 'APROBADA', 'RECHAZADA'];
    if (estado && !validStates.includes(estado)) {
      return errorResponse(res, `Estado inválido. Debe ser uno de: ${validStates.join(', ')}`, 400);
    }

    let application;
    let modelName = 'CreditApplication';

    if (tipo === 'INVERSION') {
      application = await InvestmentApplication.findByPk(id);
      modelName = 'InvestmentApplication';
    } else {
      application = await CreditApplication.findByPk(id);
    }

    if (!application) {
      return errorResponse(res, 'Solicitud no encontrada.', 404);
    }

    if (estado === 'APROBADA') {
      const applicationDocumentFilter = tipo === 'INVERSION'
        ? { investmentApplicationId: application.id }
        : { creditApplicationId: application.id };

      const validatedDocuments = await Document.findAll({
        where: {
          ...applicationDocumentFilter,
          estado: 'VALIDADO',
        },
        attributes: ['tipo'],
      });

      const validatedTypes = new Set(validatedDocuments.map(document => document.tipo));
      const missingDocumentTypes = REQUIRED_DOCUMENT_TYPES.filter(type => !validatedTypes.has(type));

      if (missingDocumentTypes.length > 0) {
        const missingLabels = missingDocumentTypes.map(type => DOCUMENT_TYPE_LABELS[type]);
        return errorResponse(
          res,
          `No se puede aprobar la solicitud. Faltan documentos validados: ${missingLabels.join(', ')}.`,
          400
        );
      }

      const targetBiometricStatus = biometriaValidada !== undefined
        ? Boolean(biometriaValidada)
        : Boolean(application.biometriaValidada);

      if (!targetBiometricStatus) {
        return errorResponse(
          res,
          'No se puede aprobar la solicitud sin completar la validación biométrica.',
          400
        );
      }
    }

    const prevStatus = application.estado;

    if (estado) application.estado = estado;
    if (observacionAsesor !== undefined) application.observacionAsesor = observacionAsesor;
    if (biometriaValidada !== undefined) application.biometriaValidada = Boolean(biometriaValidada);
    application.asesorId = req.user.id;

    await application.save();

    await logAudit({
      req,
      accion: 'CAMBIAR_ESTADO',
      entidad: modelName,
      entidadId: application.id,
      detalles: {
        estadoAnterior: prevStatus,
        nuevoEstado: application.estado,
        biometriaValidada: application.biometriaValidada,
      },
    });

    return successResponse(res, { application }, 200, 'Estado de la solicitud actualizado correctamente.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCreditApplication,
  getMyCreditApplications,
  getCreditApplicationById,
  createInvestmentApplication,
  getMyInvestmentApplications,
  getInvestmentApplicationById,
  getAllApplications,
  updateApplicationStatus,
};
