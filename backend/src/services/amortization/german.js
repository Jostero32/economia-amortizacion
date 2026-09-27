/**
 * Servicio de Amortización - Sistema Alemán (Amortización Constante)
 *
 * Fórmula:
 * amortizacion = P / n
 * interes = saldoInicial * i
 * cuota = amortizacion + interes
 * saldoFinal = saldoInicial - amortizacion
 *
 * Características:
 * - Amortización a capital constante
 * - Interés decreciente en cada período
 * - Cuota total decreciente
 * - La última cuota absorbe la diferencia de redondeo del capital constante
 */

const { roundToTwo } = require('../../utils/money');
const { buildSchedule } = require('./schedule');

/**
 * Calcula la tabla de amortización bajo el sistema Alemán
 * @param {Object} params
 * @param {number} params.principal - Monto original del crédito
 * @param {number} params.monthlyRate - Tasa del período en decimal (ej: 0.0122 si el pago es mensual)
 * @param {number} params.termMonths - Plazo en meses
 * @param {number} [params.monthsPerPeriod=1] - Meses entre cuotas (1 mensual, 3 trimestral, 6 semestral)
 * @param {string} params.startDate - Fecha de desembolso (YYYY-MM-DD)
 * @param {Array} params.charges - Cargos aplicables; solo se usan los que se cobran en cada cuota
 * @returns {Object} Resumen y detalle de cuotas
 */
function calculateGermanAmortization({
  principal,
  monthlyRate,
  termMonths,
  monthsPerPeriod = 1,
  startDate,
  charges = [],
}) {
  if (principal <= 0) {
    throw new Error('El monto del crédito debe ser mayor a cero.');
  }
  if (termMonths <= 0 || !Number.isInteger(termMonths)) {
    throw new Error('El plazo en meses debe ser un entero positivo mayor a cero.');
  }
  if (monthlyRate < 0) {
    throw new Error('La tasa de interés no puede ser negativa.');
  }

  const P = Number(principal);
  const n = termMonths / monthsPerPeriod;

  // Amortización constante teórica a capital
  const amortizacionConstante = roundToTwo(P / n);

  const schedule = buildSchedule({
    principal: P,
    periodRate: Number(monthlyRate),
    periods: n,
    monthsPerPeriod,
    startDate,
    charges,
    capitalFor: () => amortizacionConstante,
  });

  return {
    sistema: 'ALEMAN',
    monto: P,
    plazoMeses: termMonths,
    cuotaInicial: schedule.rows[0] ? schedule.rows[0].cuota : 0,
    ...schedule,
  };
}

module.exports = {
  calculateGermanAmortization,
  roundToTwo,
};
