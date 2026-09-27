const { Op } = require('sequelize');
const {
  CreditApplication,
  InvestmentApplication,
  CreditSimulation,
  InvestmentSimulation,
  AmortizationRow,
  CreditType,
  InvestmentProduct,
  InvestmentRate,
  Document,
  User,
  Institution,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../utils/auditLogger');
const { roundToTwo, formatMoney } = require('../utils/money');
const { todayISO, daysBetween, addMonthsClamped, ageOn, toISODate } = require('../utils/dates');
const { calculateInvestment, resolveInvestmentRate } = require('../services/investment/calculator');
const { quoteCredit, saveCreditSimulation } = require('../services/credit/creditQuote');
const {
  generateCreditSimulationPDF,
  generateInvestmentSimulationPDF,
} = require('../services/pdf/pdfService');

// Edad máxima al terminar de pagar el crédito (referencia: BIESS 77 años, bancos privados hasta 82)
const MAX_AGE_AT_MATURITY = 80;
// Las tasas cambian cada mes: una simulación sirve para solicitar durante 30 días
const SIMULATION_VALIDITY_DAYS = 30;

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

// Flujo de una solicitud: el análisis (EN_REVISION) es previo a la aprobación
const STATUS_TRANSITIONS = {
  PENDIENTE: ['EN_REVISION', 'PENDIENTE_DOCUMENTOS', 'RECHAZADA'],
  EN_REVISION: ['PENDIENTE_DOCUMENTOS', 'APROBADA', 'RECHAZADA'],
  PENDIENTE_DOCUMENTOS: ['EN_REVISION', 'RECHAZADA'],
  APROBADA: [],
  RECHAZADA: [],
};

const STATUS_LABELS = {
  PENDIENTE: 'pendiente',
  EN_REVISION: 'en revisión',
  PENDIENTE_DOCUMENTOS: 'con documentos pendientes',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
};

// El cliente debe saber qué corregir cuando se le piden documentos o se rechaza su solicitud
const STATUSES_REQUIRING_NOTE = ['PENDIENTE_DOCUMENTOS', 'RECHAZADA'];

const CLOSED_STATUSES = ['APROBADA', 'RECHAZADA'];

/**
 * Código correlativo anual: SOL-CRE-2026-000001
 */
async function nextApplicationCode(Model, prefix) {
  const base = `${prefix}-${todayISO().slice(0, 4)}-`;
  const last = await Model.findOne({
    where: { codigo: { [Op.like]: `${base}______` } },
    order: [['codigo', 'DESC']],
    attributes: ['codigo'],
  });
  const next = last ? Number(last.codigo.slice(base.length)) + 1 : 1;
  return `${base}${String(next).padStart(6, '0')}`;
}

/**
 * Crea la solicitud con su código; reintenta si dos solicitudes toman el mismo número a la vez
 */
async function createWithCode(Model, prefix, data) {
  for (let attempt = 1; ; attempt++) {
    const codigo = await nextApplicationCode(Model, prefix);
    try {
      return await Model.create({ ...data, codigo });
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError' || attempt >= 3) throw error;
    }
  }
}

function simulationAgeInDays(simulation) {
  return daysBetween(toISODate(new Date(simulation.createdAt)), todayISO());
}

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
      cargosOpcionales,
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

    let simulation;
    let rows;

    if (simulationId) {
      simulation = await CreditSimulation.findByPk(simulationId, {
        include: [{ model: AmortizationRow, as: 'rows' }],
        order: [[{ model: AmortizationRow, as: 'rows' }, 'numeroCuota', 'ASC']],
      });
      if (!simulation) {
        return errorResponse(res, 'La simulación indicada no existe.', 404);
      }
      if (simulation.userId && simulation.userId !== userId) {
        return errorResponse(res, 'La simulación indicada pertenece a otro usuario.', 403);
      }
      if (
        Number(simulation.creditTypeId) !== Number(creditTypeId) ||
        Number(simulation.monto) !== Number(monto) ||
        Number(simulation.plazoMeses) !== Number(plazoMeses) ||
        simulation.sistemaAmortizacion !== sistemaAmortizacion
      ) {
        return errorResponse(res, 'Los datos no coinciden con la simulación. Vuelve a simular el crédito.', 400);
      }

      const existing = await CreditApplication.findOne({ where: { simulationId } });
      if (existing) {
        return errorResponse(res, `Ya registraste la solicitud ${existing.codigo} con esta simulación.`, 409);
      }

      if (simulationAgeInDays(simulation) > SIMULATION_VALIDITY_DAYS) {
        return errorResponse(
          res,
          `La simulación tiene más de ${SIMULATION_VALIDITY_DAYS} días. Vuelve a simular con las tasas vigentes.`,
          400
        );
      }

      const product = await CreditType.findByPk(creditTypeId);
      if (!product || !product.activo) {
        return errorResponse(res, 'El producto de crédito ya no está disponible.', 400);
      }
      if (Number(product.tasaInstitucion) !== Number(simulation.tasaAnual)) {
        return errorResponse(
          res,
          'La tasa del producto cambió desde tu simulación. Vuelve a simular para ver las condiciones vigentes.',
          400
        );
      }

      // Una simulación hecha sin sesión pasa a ser del cliente que solicita
      if (!simulation.userId) {
        await simulation.update({ userId });
      }
      rows = simulation.rows;
    } else {
      // Sin simulación previa se cotiza con las condiciones vigentes y se guarda la tabla
      const quote = await quoteCredit({
        creditTypeId,
        amount: monto,
        termMonths: plazoMeses,
        amortizationSystem: sistemaAmortizacion,
        cargosOpcionales,
      });
      simulation = await saveCreditSimulation(quote.result, { creditTypeId, userId });
      rows = quote.result.rows;
    }

    // Capacidad de pago: la cuota más alta (con seguros) debe caber en los ingresos disponibles
    const cuotaMaxima = rows.reduce((max, row) => Math.max(max, Number(row.totalPago)), 0);
    const disponible = roundToTwo(Number(ingresosMensuales) - Number(egresosMensuales));
    if (cuotaMaxima > disponible) {
      return errorResponse(
        res,
        `La cuota de ${formatMoney(cuotaMaxima)} supera tus ingresos disponibles de ${formatMoney(Math.max(disponible, 0))}. Prueba con un monto menor o un plazo mayor.`,
        400,
        { ingresosMensuales: 'Tus ingresos disponibles no cubren la cuota.' }
      );
    }

    const fechaFinCredito = addMonthsClamped(todayISO(), Number(plazoMeses));
    if (ageOn(fechaNacimiento, fechaFinCredito) > MAX_AGE_AT_MATURITY) {
      return errorResponse(
        res,
        `Al terminar de pagar tendrías más de ${MAX_AGE_AT_MATURITY} años. Elige un plazo más corto.`,
        400,
        { plazoMeses: 'El plazo supera la edad máxima permitida al finalizar el crédito.' }
      );
    }

    const application = await createWithCode(CreditApplication, 'SOL-CRE', {
      userId,
      simulationId: simulation.id,
      creditTypeId,
      monto: Number(monto),
      plazoMeses: parseInt(plazoMeses, 10),
      sistemaAmortizacion,
      tasaAplicada: simulation.tasaAnual,
      cuotaEstimada: rows[0] ? rows[0].totalPago : simulation.cuotaInicial,
      estado: 'PENDIENTE',
      nombres,
      apellidos,
      cedula,
      fechaNacimiento,
      estadoCivil: estadoCivil || null,
      direccion,
      ciudad,
      telefono,
      email,
      actividadEconomica,
      ingresosMensuales: Number(ingresosMensuales),
      egresosMensuales: Number(egresosMensuales),
      relacionCuotaIngreso: roundToTwo((cuotaMaxima / Number(ingresosMensuales)) * 100),
      autorizaConsultaBuro: true,
      fechaAutorizacionBuro: new Date(),
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
 * Obtener detalle de solicitud de crédito con su tabla de amortización
 */
async function getCreditApplicationById(req, res, next) {
  try {
    const { id } = req.params;
    const application = await CreditApplication.findByPk(id, {
      include: [
        { model: CreditType, as: 'creditType' },
        { model: Document, as: 'documents' },
        {
          model: CreditSimulation,
          as: 'simulation',
          include: [{ model: AmortizationRow, as: 'rows' }],
        },
        { model: User, as: 'user', attributes: ['id', 'nombre', 'email', 'rol'] },
        { model: User, as: 'asesor', attributes: ['id', 'nombre', 'email'] },
      ],
      order: [[{ model: CreditSimulation, as: 'simulation' }, { model: AmortizationRow, as: 'rows' }, 'numeroCuota', 'ASC']],
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

    const product = await InvestmentProduct.findByPk(investmentProductId, {
      include: [{ model: InvestmentRate, as: 'rates', where: { activo: true }, required: false }],
    });
    if (!product || !product.activo) {
      return errorResponse(res, 'El producto de inversión no está disponible.', 404);
    }

    let simulation;

    if (simulationId) {
      simulation = await InvestmentSimulation.findByPk(simulationId);
      if (!simulation) {
        return errorResponse(res, 'La simulación de inversión indicada no existe.', 404);
      }
      if (simulation.userId && simulation.userId !== userId) {
        return errorResponse(res, 'La simulación indicada pertenece a otro usuario.', 403);
      }
      if (Number(simulation.investmentProductId) !== Number(investmentProductId)) {
        return errorResponse(res, 'El producto no corresponde a la simulación de inversión.', 400);
      }
      if (Number(simulation.monto) !== Number(monto) || Number(simulation.plazoDias) !== Number(plazoDias)) {
        return errorResponse(res, 'El monto o plazo no corresponde a la simulación de inversión.', 400);
      }

      const existing = await InvestmentApplication.findOne({ where: { simulationId } });
      if (existing) {
        return errorResponse(res, `Ya registraste la solicitud ${existing.codigo} con esta simulación.`, 409);
      }

      if (simulationAgeInDays(simulation) > SIMULATION_VALIDITY_DAYS) {
        return errorResponse(
          res,
          `La simulación tiene más de ${SIMULATION_VALIDITY_DAYS} días. Vuelve a simular con las tasas vigentes.`,
          400
        );
      }
      if (resolveInvestmentRate(product, Number(plazoDias)) !== Number(simulation.tasaAnual)) {
        return errorResponse(
          res,
          'La tasa del producto cambió desde tu simulación. Vuelve a simular para ver las condiciones vigentes.',
          400
        );
      }

      if (!simulation.userId) {
        await simulation.update({ userId });
      }
    } else {
      if (Number(monto) < Number(product.montoMinimo) || Number(monto) > Number(product.montoMaximo)) {
        return errorResponse(
          res,
          `El monto debe estar entre ${formatMoney(product.montoMinimo)} y ${formatMoney(product.montoMaximo)}.`,
          400
        );
      }
      if (Number(plazoDias) < product.plazoMinimoDias || Number(plazoDias) > product.plazoMaximoDias) {
        return errorResponse(
          res,
          `El plazo debe estar entre ${product.plazoMinimoDias} y ${product.plazoMaximoDias} días.`,
          400
        );
      }

      // Sin simulación previa se calcula con la tasa del tramo vigente y se guarda el resultado
      const result = calculateInvestment({
        amount: Number(monto),
        termDays: Number(plazoDias),
        annualRate: resolveInvestmentRate(product, Number(plazoDias)),
        interestPayment: product.pagoIntereses,
      });
      simulation = await InvestmentSimulation.create({
        investmentProductId: product.id,
        userId,
        monto: result.capital,
        plazoDias: result.plazoDias,
        tasaAnual: result.tasaAnual,
        tasaEfectiva: result.tasaEfectiva,
        pagoIntereses: result.pagoIntereses,
        cronogramaPagos: result.cronogramaPagos,
        interesGanado: result.interesGanado,
        tasaRetencion: result.tasaRetencion,
        retencionIR: result.retencionIR,
        interesNeto: result.interesNeto,
        valorFinal: result.valorFinal,
        fechaInicio: result.fechaInicio,
        fechaVencimiento: result.fechaVencimiento,
      });
    }

    const application = await createWithCode(InvestmentApplication, 'SOL-INV', {
      userId,
      simulationId: simulation.id,
      investmentProductId,
      monto: Number(monto),
      plazoDias: parseInt(plazoDias, 10),
      tasaAplicada: simulation.tasaAnual,
      interesEstimado: simulation.interesGanado,
      valorFinalEstimado: simulation.valorFinal,
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
      declaraLicitudFondos: true,
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

    if (!['CREDITO', 'INVERSION'].includes(tipo)) {
      return errorResponse(res, 'El tipo de solicitud debe ser CREDITO o INVERSION.', 400);
    }
    if (estado && !Object.keys(STATUS_TRANSITIONS).includes(estado)) {
      return errorResponse(res, `Estado inválido. Debe ser uno de: ${Object.keys(STATUS_TRANSITIONS).join(', ')}`, 400);
    }

    const isInvestment = tipo === 'INVERSION';
    const modelName = isInvestment ? 'InvestmentApplication' : 'CreditApplication';
    const application = isInvestment
      ? await InvestmentApplication.findByPk(id)
      : await CreditApplication.findByPk(id);

    if (!application) {
      return errorResponse(res, 'Solicitud no encontrada.', 404);
    }

    const prevStatus = application.estado;

    if (CLOSED_STATUSES.includes(prevStatus)) {
      return errorResponse(
        res,
        `La solicitud ya fue ${STATUS_LABELS[prevStatus]} y no se puede modificar.`,
        400
      );
    }

    if (estado && estado !== prevStatus && !STATUS_TRANSITIONS[prevStatus].includes(estado)) {
      return errorResponse(
        res,
        `Una solicitud ${STATUS_LABELS[prevStatus]} no puede pasar a ${STATUS_LABELS[estado]}.`,
        400
      );
    }

    const nota = observacionAsesor !== undefined ? String(observacionAsesor).trim() : '';
    if (estado && estado !== prevStatus && STATUSES_REQUIRING_NOTE.includes(estado) && !nota) {
      return errorResponse(
        res,
        'Escribe una observación para el cliente explicando el motivo.',
        400,
        { observacionAsesor: 'La observación es obligatoria para este estado.' }
      );
    }

    if (estado === 'APROBADA') {
      const applicationDocumentFilter = isInvestment
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

    if (estado) application.estado = estado;
    if (observacionAsesor !== undefined) application.observacionAsesor = nota || null;
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

function sendPdfHeaders(res, fileName) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
}

/**
 * PDF de la solicitud de crédito con los datos del solicitante y su tabla de amortización
 * (cliente propietario, asesor o administrador)
 */
async function getCreditApplicationPDF(req, res, next) {
  try {
    const application = await CreditApplication.findByPk(req.params.id, {
      include: [
        {
          model: CreditSimulation,
          as: 'simulation',
          include: [
            { model: AmortizationRow, as: 'rows' },
            { model: CreditType, as: 'creditType' },
          ],
        },
      ],
      order: [[{ model: CreditSimulation, as: 'simulation' }, { model: AmortizationRow, as: 'rows' }, 'numeroCuota', 'ASC']],
    });

    if (!application) {
      return errorResponse(res, 'Solicitud de crédito no encontrada.', 404);
    }
    if (req.user.rol === 'CLIENTE' && application.userId !== req.user.id) {
      return errorResponse(res, 'No tiene permiso para ver esta solicitud.', 403);
    }
    if (!application.simulation) {
      return errorResponse(res, 'La solicitud no tiene una tabla de amortización asociada.', 404);
    }

    const institution = await Institution.findOne({ where: { activo: true } });
    sendPdfHeaders(res, `Solicitud_${application.codigo}.pdf`);
    generateCreditSimulationPDF(
      {
        institution,
        simulation: application.simulation,
        rows: application.simulation.rows,
        application,
      },
      res
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PDF de la solicitud de inversión (cliente propietario, asesor o administrador)
 */
async function getInvestmentApplicationPDF(req, res, next) {
  try {
    const application = await InvestmentApplication.findByPk(req.params.id, {
      include: [
        {
          model: InvestmentSimulation,
          as: 'simulation',
          include: [{ model: InvestmentProduct, as: 'product' }],
        },
      ],
    });

    if (!application) {
      return errorResponse(res, 'Solicitud de inversión no encontrada.', 404);
    }
    if (req.user.rol === 'CLIENTE' && application.userId !== req.user.id) {
      return errorResponse(res, 'No tiene permiso para ver esta solicitud.', 403);
    }
    if (!application.simulation) {
      return errorResponse(res, 'La solicitud no tiene un cálculo de rendimiento asociado.', 404);
    }

    const institution = await Institution.findOne({ where: { activo: true } });
    sendPdfHeaders(res, `Solicitud_${application.codigo}.pdf`);
    generateInvestmentSimulationPDF({ institution, simulation: application.simulation, application }, res);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  CLOSED_STATUSES,
  STATUS_TRANSITIONS,
  createCreditApplication,
  getMyCreditApplications,
  getCreditApplicationById,
  createInvestmentApplication,
  getMyInvestmentApplications,
  getInvestmentApplicationById,
  getCreditApplicationPDF,
  getInvestmentApplicationPDF,
  getAllApplications,
  updateApplicationStatus,
};
