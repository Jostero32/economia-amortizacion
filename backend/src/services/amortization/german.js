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
 * - Cuota total decreciente mes a mes
 * - La última cuota absorbe la diferencia de redondeo del capital constante
 */

const { roundToTwo } = require('../../utils/money');
const { addMonthsClamped, todayISO } = require('../../utils/dates');
const { createPeriodicChargesAccumulator } = require('./charges');

/**
 * Calcula la tabla de amortización bajo el sistema Alemán
 * @param {Object} params
 * @param {number} params.principal - Monto original del crédito
 * @param {number} params.monthlyRate - Tasa periódica mensual en decimal (ej: 0.0122)
 * @param {number} params.termMonths - Plazo en meses
 * @param {string} params.startDate - Fecha de desembolso (YYYY-MM-DD)
 * @param {Array} params.charges - Cargos aplicables; solo se usan los que se cobran en cada cuota
 * @returns {Object} Resumen y detalle de cuotas
 */
function calculateGermanAmortization({ principal, monthlyRate, termMonths, startDate, charges = [] }) {
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
  const n = Number(termMonths);

  // Amortización constante teórica a capital
  const amortizacionConstante = roundToTwo(P / n);

  const rows = [];
  let saldoInicial = P;
  let totalCapital = 0;
  let totalIntereses = 0;
  let totalCargos = 0;
  let totalPagar = 0;

  const fechaBase = startDate || todayISO();
  const periodicCharges = createPeriodicChargesAccumulator(charges);

  for (let k = 1; k <= n; k++) {
    // Mismo día cada mes (o el último día si el mes es más corto)
    const fechaPagoStr = addMonthsClamped(fechaBase, k);

    const interes = roundToTwo(saldoInicial * i);

    let capital;
    let cuota;
    let saldoFinal;

    if (k === n) {
      // Ajuste final para saldo exactamente 0.00 y suma de capital = P
      capital = roundToTwo(saldoInicial);
      cuota = roundToTwo(capital + interes);
      saldoFinal = 0.00;
    } else {
      capital = amortizacionConstante;
      if (capital > saldoInicial) {
        capital = saldoInicial;
      }
      cuota = roundToTwo(capital + interes);
      saldoFinal = roundToTwo(saldoInicial - capital);
    }

    const cargosCuota = periodicCharges.forInstallment({ principal: P, saldoInicial, cuota });
    const totalPago = roundToTwo(cuota + cargosCuota);

    totalCapital = roundToTwo(totalCapital + capital);
    totalIntereses = roundToTwo(totalIntereses + interes);
    totalCargos = roundToTwo(totalCargos + cargosCuota);
    totalPagar = roundToTwo(totalPagar + totalPago);

    rows.push({
      numeroCuota: k,
      fechaPago: fechaPagoStr,
      saldoInicial: roundToTwo(saldoInicial),
      cuota,
      capital,
      interes,
      cargos: cargosCuota,
      totalPago,
      saldoFinal,
    });

    saldoInicial = saldoFinal;
  }

  return {
    sistema: 'ALEMAN',
    monto: P,
    plazoMeses: n,
    cuotaInicial: rows[0] ? rows[0].cuota : 0,
    totalCapital,
    totalIntereses,
    totalCargos,
    totalPagar,
    cargosPeriodicos: periodicCharges.summary(),
    rows,
  };
}

module.exports = {
  calculateGermanAmortization,
  roundToTwo,
};
