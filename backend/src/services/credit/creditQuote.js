const { Op } = require('sequelize');
const { CreditType, CreditSegment, Charge, CreditSimulation, AmortizationRow } = require('../../models');
const { calculateAmortization } = require('../amortization');
const { selectApplicableCharges, segmentRequiresLifeInsurance } = require('../amortization/charges');
const { todayISO } = require('../../utils/dates');
const { httpError } = require('../../utils/httpError');
const { formatMoney } = require('../../utils/money');

/**
 * Calcula la cotización de un crédito con las condiciones vigentes del producto, sin guardarla.
 * La usan la simulación pública, la comparación de sistemas y la solicitud de crédito.
 *
 * @param {Object} params
 * @param {number} params.creditTypeId
 * @param {number} params.amount - Monto solicitado
 * @param {number} params.termMonths - Plazo en meses
 * @param {string} [params.amortizationSystem='FRANCES']
 * @param {string} [params.startDate] - Fecha de desembolso
 * @param {Array<number>} [params.cargosOpcionales] - Cargos opcionales aceptados por el cliente
 * @returns {Promise<{ product: Object, result: Object, tasaMaximaBCE: number, requiereDesgravamen: boolean }>}
 */
async function quoteCredit({ creditTypeId, amount, termMonths, amortizationSystem, startDate, cargosOpcionales }) {
  const product = await CreditType.findByPk(creditTypeId, {
    include: [{ model: CreditSegment, as: 'segment' }],
  });

  if (!product || !product.activo) {
    throw httpError('El producto de crédito seleccionado no existe o no está activo.', 404);
  }

  const P = Number(amount);
  const n = parseInt(termMonths, 10);

  // Límites del producto
  if (P < Number(product.montoMinimo) || P > Number(product.montoMaximo)) {
    throw httpError(
      `El monto debe estar entre ${formatMoney(product.montoMinimo)} y ${formatMoney(product.montoMaximo)}.`
    );
  }
  if (n < product.plazoMinimo || n > product.plazoMaximo) {
    throw httpError(`El plazo debe estar entre ${product.plazoMinimo} y ${product.plazoMaximo} meses.`);
  }

  // La TEA del producto no puede superar la tasa efectiva máxima del BCE para su segmento
  const tasaInstitucion = Number(product.tasaInstitucion);
  const tasaMaximaBCE = Number(product.segment.tasaMaxima);
  if (tasaInstitucion > tasaMaximaBCE) {
    throw httpError('La tasa configurada supera la tasa activa efectiva máxima registrada para este segmento.');
  }

  // Cargos activos generales y del producto. Los opcionales solo se aplican si el cliente los
  // acepta; el desgravamen es obligatorio en créditos de vivienda.
  const requiereDesgravamen = segmentRequiresLifeInsurance(product.segment.codigo);
  const activeCharges = await Charge.findAll({
    where: {
      activo: true,
      [Op.or]: [{ creditTypeId: null }, { creditTypeId: product.id }],
    },
  });
  const charges = selectApplicableCharges(
    activeCharges.map((charge) => charge.get({ plain: true })),
    { acceptedOptionalIds: cargosOpcionales, requiresLifeInsurance: requiereDesgravamen }
  );

  const result = calculateAmortization({
    amount: P,
    termMonths: n,
    annualRate: tasaInstitucion,
    system: (amortizationSystem || 'FRANCES').toUpperCase().trim(),
    startDate: startDate || todayISO(),
    charges,
  });

  return { product, result, tasaMaximaBCE, requiereDesgravamen };
}

/**
 * Datos del producto que acompañan a una cotización en las respuestas del API
 */
function productSummary({ product, tasaMaximaBCE, requiereDesgravamen }) {
  return {
    id: product.id,
    nombre: product.nombre,
    segmento: product.segment.nombre,
    tasaMaximaBCE,
    requiereDesgravamen,
  };
}

/**
 * Guarda una cotización como simulación con su tabla de amortización
 * @param {Object} result - Resultado de calculateAmortization
 * @param {Object} options - { creditTypeId, userId }
 * @returns {Promise<Object>} Simulación guardada
 */
async function saveCreditSimulation(result, { creditTypeId, userId = null }) {
  const simulation = await CreditSimulation.create({
    creditTypeId,
    userId,
    monto: result.monto,
    plazoMeses: result.plazoMeses,
    sistemaAmortizacion: result.sistema,
    tasaAnual: result.tasaAnual,
    tasaNominal: result.tasaNominal,
    tasaMensual: result.tasaMensual,
    cuotaInicial: result.cuotaInicial,
    totalCapital: result.totalCapital,
    totalIntereses: result.totalIntereses,
    totalCargos: result.totalCargos,
    totalPagar: result.totalPagar,
    cargosDesembolso: result.cargosDesembolso,
    montoLiquido: result.montoLiquido,
    costoEfectivoAnual: result.costoEfectivoAnual,
    desgloseCargos: result.desgloseCargos,
    fechaInicio: result.fechaInicio,
  });

  await AmortizationRow.bulkCreate(result.rows.map((row) => ({ ...row, simulationId: simulation.id })));
  return simulation;
}

module.exports = {
  quoteCredit,
  productSummary,
  saveCreditSimulation,
};
