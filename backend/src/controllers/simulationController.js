const {
  CreditType,
  CreditSegment,
  CreditSimulation,
  AmortizationRow,
  InvestmentProduct,
  InvestmentRate,
  InvestmentSimulation,
  Institution,
} = require('../models');
const { quoteCredit, productSummary, saveCreditSimulation } = require('../services/credit/creditQuote');
const { calculateInvestment, resolveInvestmentRate } = require('../services/investment/calculator');
const {
  generateCreditSimulationPDF,
  generateInvestmentSimulationPDF,
} = require('../services/pdf/pdfService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { todayISO } = require('../utils/dates');

/**
 * Simulación de Crédito (PÚBLICA - No requiere autenticación)
 */
async function simulateCredit(req, res, next) {
  try {
    const quote = await quoteCredit(req.body);
    const { result } = quote;

    // Guardar la simulación y su tabla de amortización
    const savedSimulation = await saveCreditSimulation(result, {
      creditTypeId: quote.product.id,
      userId: req.user ? req.user.id : null,
    });

    return successResponse(
      res,
      {
        simulation: savedSimulation,
        rows: result.rows,
        product: productSummary(quote),
      },
      201,
      'Simulación de crédito calculada con éxito.'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Compara los sistemas Francés y Alemán con los mismos datos, sin guardar simulaciones
 */
async function compareCreditSystems(req, res, next) {
  try {
    const [frances, aleman] = await Promise.all(
      ['FRANCES', 'ALEMAN'].map((sistema) => quoteCredit({ ...req.body, amortizationSystem: sistema }))
    );

    const summarize = ({ result }) => {
      const lastRow = result.rows[result.rows.length - 1];
      return {
        sistema: result.sistema,
        primeraCuota: result.rows[0].totalPago,
        ultimaCuota: lastRow.totalPago,
        totalIntereses: result.totalIntereses,
        totalCargos: result.totalCargos,
        totalPagar: result.totalPagar,
        montoLiquido: result.montoLiquido,
        costoEfectivoAnual: result.costoEfectivoAnual,
      };
    };

    return successResponse(res, {
      product: productSummary(frances),
      frances: summarize(frances),
      aleman: summarize(aleman),
    });
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

    // Tasa correspondiente al tramo de días
    const applicableRate = resolveInvestmentRate(product, dias);

    const result = calculateInvestment({
      amount: P,
      termDays: dias,
      annualRate: applicableRate,
      startDate: startDate || todayISO(),
      interestPayment: product.pagoIntereses,
    });

    const userId = req.user ? req.user.id : null;

    const savedSimulation = await InvestmentSimulation.create({
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

    return successResponse(
      res,
      {
        simulation: savedSimulation,
        product: {
          id: product.id,
          nombre: product.nombre,
          pagoIntereses: product.pagoIntereses,
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
    const [simulations, investmentSimulations] = await Promise.all([
      CreditSimulation.findAll({
        where: { userId: req.user.id },
        include: [{ model: CreditType, as: 'creditType' }],
        order: [['createdAt', 'DESC']],
      }),
      InvestmentSimulation.findAll({
        where: { userId: req.user.id },
        include: [{ model: InvestmentProduct, as: 'product' }],
        order: [['createdAt', 'DESC']],
      }),
    ]);
    return successResponse(res, { simulations, investmentSimulations });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  simulateCredit,
  compareCreditSystems,
  getCreditSimulationById,
  getCreditSimulationPDF,
  simulateInvestment,
  getInvestmentSimulationById,
  getInvestmentSimulationPDF,
  getMyCreditSimulations,
};

