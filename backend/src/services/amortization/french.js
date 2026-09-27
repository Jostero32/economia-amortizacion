/**
 * Servicio de Amortización - Sistema Francés (Cuotas Constantes)
 *
 * Fórmula de la cuota:
 * C = P * [ i(1+i)^n ] / [ (1+i)^n - 1 ]
 *
 * Donde:
 * P = Principal (Monto del préstamo)
 * i = Tasa de interés del período (mensual, trimestral, etc.)
 * n = Número total de cuotas
 */

const { roundToTwo } = require('../../utils/money');
const { buildSchedule, frenchInstallment } = require('./schedule');

/**
 * Calcula la tabla de amortización bajo el sistema Francés
 * @param {Object} params
 * @param {number} params.principal - Monto original del crédito
 * @param {number} params.monthlyRate - Tasa del período en decimal (ej: 0.0122 si el pago es mensual)
 * @param {number} params.termMonths - Plazo en meses
 * @param {number} [params.monthsPerPeriod=1] - Meses entre cuotas (1 mensual, 3 trimestral, 6 semestral)
 * @param {string} params.startDate - Fecha de desembolso (YYYY-MM-DD)
 * @param {Array} params.charges - Cargos aplicables; solo se usan los que se cobran en cada cuota
 * @returns {Object} Resumen y detalle de cuotas
 */
function calculateFrenchAmortization({
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
  const i = Number(monthlyRate);
  const n = termMonths / monthsPerPeriod;

  // La cuota que se publica al cliente es la cuota redondeada a centavos
  const cuotaFija = roundToTwo(frenchInstallment(P, i, n));

  const schedule = buildSchedule({
    principal: P,
    periodRate: i,
    periods: n,
    monthsPerPeriod,
    startDate,
    charges,
    capitalFor: (numero, saldoInicial, interes) => cuotaFija - interes,
  });

  return {
    sistema: 'FRANCES',
    monto: P,
    plazoMeses: termMonths,
    cuotaInicial: schedule.rows[0] ? schedule.rows[0].cuota : 0,
    ...schedule,
  };
}

module.exports = {
  calculateFrenchAmortization,
  roundToTwo,
};
