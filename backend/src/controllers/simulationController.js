const {
  CreditType,
  CreditSegment,
  CreditSimulation,
  AmortizationRow,
  Charge,
  InvestmentProduct,
  InvestmentRate,
  InvestmentSimulation,
  Institution,
} = require('../models');
const { calculateAmortization } = require('../services/amortization');
const { calculateInvestment } = require('../services/investment/calculator');
const {
  generateCreditSimulationPDF,
  generateInvestmentSimulationPDF,
} = require('../services/pdf/pdfService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { Op } = require('sequelize');

/**
 * Simulación de Crédito (PÚBLICA - No requiere autenticación)
 */
async function simulateCredit(req, res, next) {
  try {
    const { creditTypeId, amount, termMonths, amortizationSystem, startDate } = req.body;

    // 1. Obtener producto de crédito y su segmento regulatorio
    const product = await CreditType.findByPk(creditTypeId, {
      include: [
        {
          model: CreditSegment,
          as: 'segment',
        },
      ],
    });

    if (!product || !product.activo) {
      return errorResponse(res, 'El producto de crédito seleccionado no existe o no está activo.', 404);
    }

    const P = Number(amount);
    const n = parseInt(termMonths, 10);
    const sistema = (amortizationSystem || 'FRANCES').toUpperCase().trim();

    // 2. Validaciones de límites del producto
    if (P < Number(product.montoMinimo) || P > Number(product.montoMaximo)) {
      return errorResponse(
        res,
        `El monto debe estar entre $${Number(product.montoMinimo).toFixed(2)} y $${Number(product.montoMaximo).toFixed(2)}.`,
        400
      );
    }

    if (n < product.plazoMinimo || n > product.plazoMaximo) {
      return errorResponse(
        res,
        `El plazo debe estar entre ${product.plazoMinimo} y ${product.plazoMaximo} meses.`,
        400
      );
    }

    // 3. Validación de tasa contra la tasa máxima del BCE para el segmento
    const tasaInstitucion = Number(product.tasaInstitucion);
    const tasaMaximaBCE = Number(product.segment.tasaMaxima);

    if (tasaInstitucion > tasaMaximaBCE) {
      return errorResponse(
        res,
        'La tasa configurada supera la tasa activa efectiva máxima registrada para este segmento.',
        400
      );
    }

    // 4. Obtener cargos aplicables (generales y específicos de este producto)
    const charges = await Charge.findAll({
      where: {
        activo: true,
        [Op.or]: [
          { creditTypeId: null },
          { creditTypeId: product.id },
        ],
      },
    });

    // 5. Ejecutar cálculo financiero puro en el servicio
    const simulationResult = calculateAmortization({
      amount: P,
      termMonths: n,
      annualRate: tasaInstitucion,
      system: sistema,
      startDate: startDate || new Date().toISOString().split('T')[0],
      charges,
    });

    // 6. Guardar la simulación en base de datos
    const userId = req.user ? req.user.id : null;

    const savedSimulation = await CreditSimulation.create({
      creditTypeId: product.id,
      userId,
      monto: simulationResult.monto,
      plazoMeses: simulationResult.plazoMeses,
      sistemaAmortizacion: simulationResult.sistema,
      tasaAnual: simulationResult.tasaAnual,
      tasaMensual: simulationResult.tasaMensual,
      cuotaInicial: simulationResult.cuotaInicial,
      totalCapital: simulationResult.totalCapital,
      totalIntereses: simulationResult.totalIntereses,
      totalCargos: simulationResult.totalCargos,
      totalPagar: simulationResult.totalPagar,
      desgloseCargos: simulationResult.desgloseCargos,
      fechaInicio: simulationResult.fechaInicio,
    });

    // 7. Guardar las filas de la tabla de amortización
    const rowsToInsert = simulationResult.rows.map(row => ({
      ...row,
      simulationId: savedSimulation.id,
    }));

    await AmortizationRow.bulkCreate(rowsToInsert);

    return successResponse(
      res,
      {
        simulation: savedSimulation,
        rows: simulationResult.rows,
        product: {
          id: product.id,
          nombre: product.nombre,
          segmento: product.segment.nombre,
          tasaMaximaBCE,
        },
      },
      201,
      'Simulación de crédito calculada con éxito.'
    );
  } catch (error) {
    next(error);
  }
}

async function getCreditSimulationById(req, res, next) {
  try {
    const { id } = req.params;
    const simulation = await CreditSimulation.findByPk(id, {
      include: [
        {
          model: CreditType,
          as: 'creditType',
          include: [{ model: CreditSegment, as: 'segment' }],
        },
        {
          model: AmortizationRow,
          as: 'rows',
        },
      ],
      order: [[{ model: AmortizationRow, as: 'rows' }, 'numeroCuota', 'ASC']],
    });

    if (!simulation) {
      return errorResponse(res, 'Simulación de crédito no encontrada.', 404);
    }

    return successResponse(res, { simulation });
  } catch (error) {
    next(error);
  }
}

async function getCreditSimulationPDF(req, res, next) {
  try {
    const { id } = req.params;
    const simulation = await CreditSimulation.findByPk(id, {
      include: [
        {
          model: CreditType,
          as: 'creditType',
        },
        {
          model: AmortizationRow,
          as: 'rows',
        },
      ],
      order: [[{ model: AmortizationRow, as: 'rows' }, 'numeroCuota', 'ASC']],
    });

    if (!simulation) {
      return errorResponse(res, 'Simulación no encontrada.', 404);
    }

    const institution = await Institution.findOne({ where: { activo: true } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Simulacion_Credito_${id.slice(0, 8)}.pdf`);

    generateCreditSimulationPDF(
      {
        institution,
        simulation,
        rows: simulation.rows,
      },
      res
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Simulación de Inversión (PÚBLICA - No requiere autenticación)
 */
async function simulateInvestment(req, res, next) {
  try {
    const { investmentProductId, amount, termDays, startDate } = req.body;

    const product = await InvestmentProduct.findByPk(investmentProductId, {
      include: [
        {
          model: InvestmentRate,
          as: 'rates',
          where: { activo: true },
          required: false,
        },
      ],
    });

    if (!product || !product.activo) {
      return errorResponse(res, 'Producto de inversión no encontrado o inactivo.', 404);
    }

    const P = Number(amount);
    const dias = parseInt(termDays, 10);

    if (P < Number(product.montoMinimo) || P > Number(product.montoMaximo)) {
      return errorResponse(
        res,
        `El monto debe estar entre $${Number(product.montoMinimo).toFixed(2)} y $${Number(product.montoMaximo).toFixed(2)}.`,
        400
      );
    }

    if (dias < product.plazoMinimoDias || dias > product.plazoMaximoDias) {
      return errorResponse(
        res,
        `El plazo debe estar entre ${product.plazoMinimoDias} y ${product.plazoMaximoDias} días.`,
        400
      );
    }

    // Buscar tasa correspondiente al tramo de días
    let applicableRate = Number(product.tasa);
    if (product.rates && product.rates.length > 0) {
      const matchRate = product.rates.find(r => dias >= r.plazoMinDias && dias <= r.plazoMaxDias);
      if (matchRate) {
        applicableRate = Number(matchRate.tasa);
      }
    }

    const result = calculateInvestment({
      amount: P,
      termDays: dias,
      annualRate: applicableRate,
      startDate: startDate || new Date().toISOString().split('T')[0],
    });

    const userId = req.user ? req.user.id : null;

    const savedSimulation = await InvestmentSimulation.create({
      investmentProductId: product.id,
      userId,
      monto: result.capital,
      plazoDias: result.plazoDias,
      tasaAnual: result.tasaAnual,
      interesGanado: result.interesGanado,
      valorFinal: result.valorFinal,
      fechaInicio: result.fechaInicio,
      fechaVencimiento: result.fechaVencimiento,
    });

    return successResponse(
      res,
      {
        simulation: savedSimulation,
        product: {
          id: product.id,
          nombre: product.nombre,
        },
      },
      201,
      'Simulación de inversión calculada con éxito.'
    );
  } catch (error) {
    next(error);
  }
}

async function getInvestmentSimulationById(req, res, next) {
  try {
    const { id } = req.params;
    const simulation = await InvestmentSimulation.findByPk(id, {
      include: [
        {
          model: InvestmentProduct,
          as: 'product',
        },
      ],
    });

    if (!simulation) {
      return errorResponse(res, 'Simulación de inversión no encontrada.', 404);
    }

    return successResponse(res, { simulation });
  } catch (error) {
    next(error);
  }
}

async function getInvestmentSimulationPDF(req, res, next) {
  try {
    const { id } = req.params;
    const simulation = await InvestmentSimulation.findByPk(id, {
      include: [{ model: InvestmentProduct, as: 'product' }],
    });

    if (!simulation) {
      return errorResponse(res, 'Simulación no encontrada.', 404);
    }

    const institution = await Institution.findOne({ where: { activo: true } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Simulacion_Inversion_${id.slice(0, 8)}.pdf`);

    generateInvestmentSimulationPDF(
      {
        institution,
        simulation,
      },
      res
    );
  } catch (error) {
    next(error);
  }
}

async function getMyCreditSimulations(req, res, next) {
  try {
    const simulations = await CreditSimulation.findAll({
      where: { userId: req.user.id },
      include: [{ model: CreditType, as: 'creditType' }],
      order: [['createdAt', 'DESC']],
    });
    return successResponse(res, { simulations });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  simulateCredit,
  getCreditSimulationById,
  getCreditSimulationPDF,
  simulateInvestment,
  getInvestmentSimulationById,
  getInvestmentSimulationPDF,
  getMyCreditSimulations,
};

