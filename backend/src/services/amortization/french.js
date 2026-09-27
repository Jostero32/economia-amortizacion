/**
 * Servicio de Amortización - Sistema Francés (Cuotas Constantes)
 *
 * Fórmula de la cuota:
 * C = P * [ i(1+i)^n ] / [ (1+i)^n - 1 ]
 *
 * Donde:
 * P = Principal (Monto del préstamo)
 * i = Tasa de interés periódica mensual
 * n = Número total de cuotas (plazo en meses)
 */

const { roundToTwo } = require('../../utils/money');
const { addMonthsClamped, todayISO } = require('../../utils/dates');
const { createPeriodicChargesAccumulator } = require('./charges');

/**
 * Calcula la tabla de amortización bajo el sistema Francés
 * @param {Object} params
 * @param {number} params.principal - Monto original del crédito
 * @param {number} params.monthlyRate - Tasa periódica mensual en decimal (ej: 0.0122)
 * @param {number} params.termMonths - Plazo en meses
 * @param {string} params.startDate - Fecha de desembolso (YYYY-MM-DD)
 * @param {Array} params.charges - Cargos aplicables; solo se usan los que se cobran en cada cuota
 * @returns {Object} Resumen y detalle de cuotas
 */
function calculateFrenchAmortization({ principal, monthlyRate, termMonths, startDate, charges = [] }) {
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

  // Cuota constante antes de cargos
  let cuotaConstante;
  if (i === 0) {
    cuotaConstante = P / n;
  } else {
    const factor = Math.pow(1 + i, n);
    cuotaConstante = P * ((i * factor) / (factor - 1));
  }

  // La cuota que se publica al cliente es la cuota redondeada a centavos
  const cuotaFija = roundToTwo(cuotaConstante);

  const rows = [];
  let saldoInicial = P;
  let totalCapital = 0;
  let totalIntereses = 0;
  let totalCargos = 0;
  let totalPagar = 0;

  const fechaBase = startDate || todayISO();
  const periodicCharges = createPeriodicChargesAccumulator(charges);

  for (let k = 1; k <= n; k++) {
    // Fecha de pago de la cuota: mismo día cada mes (o el último día si el mes es más corto)
    const fechaPagoStr = addMonthsClamped(fechaBase, k);

    // Interés del período sobre saldo inicial
    const interes = roundToTwo(saldoInicial * i);

    let capital;
    let cuota;
    let saldoFinal;

    if (k === n) {
      // Ajuste de última cuota por redondeo de centavos
      capital = roundToTwo(saldoInicial);
      cuota = roundToTwo(capital + interes);
      saldoFinal = 0.00;
    } else {
      capital = roundToTwo(cuotaFija - interes);
      // Garantizar que no exceda el saldo si hay desviaciones por centavos
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
    sistema: 'FRANCES',
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
  calculateFrenchAmortization,
  roundToTwo,
};
