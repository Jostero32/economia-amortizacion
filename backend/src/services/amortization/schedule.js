/**
 * Generador de cronogramas de pago compartido por los sistemas francés y alemán y por la
 * simulación de abonos extraordinarios.
 *
 * Cada período cobra interés sobre el saldo inicial; el capital de cada cuota lo define el
 * sistema (`capitalFor`). La última cuota paga todo el saldo pendiente para cerrar en 0.00.
 */

const { roundToTwo } = require('../../utils/money');
const { addMonthsClamped, todayISO } = require('../../utils/dates');
const { createPeriodicChargesAccumulator } = require('./charges');

// Un crédito nunca supera 360 meses; es un límite de seguridad para cronogramas abiertos
const MAX_PERIODS = 360;

/**
 * @param {Object} params
 * @param {number} params.principal - Saldo de capital al inicio del cronograma
 * @param {number} params.periodRate - Tasa del período en decimal
 * @param {number|null} params.periods - Número de cuotas; null para amortizar hasta saldar la deuda
 * @param {Function} params.capitalFor - (numero, saldoInicial, interes) => capital de la cuota
 * @param {number} [params.monthsPerPeriod=1] - Meses entre cuotas
 * @param {string} [params.startDate] - Fecha de desembolso; las cuotas vencen cada `monthsPerPeriod` meses
 * @param {number} [params.firstNumber=1] - Número de la primera cuota (para continuar un cronograma)
 * @param {number} [params.chargeBase] - Monto sobre el que se calculan los cargos "sobre el monto"
 * @param {Array} [params.charges] - Cargos aplicables; solo se usan los periódicos
 */
function buildSchedule({
  principal,
  periodRate,
  periods,
  capitalFor,
  monthsPerPeriod = 1,
  startDate,
  firstNumber = 1,
  chargeBase,
  charges = [],
}) {
  const fechaBase = startDate || todayISO();
  const periodicCharges = createPeriodicChargesAccumulator(charges);
  const base = chargeBase ?? principal;

  const rows = [];
  let saldoInicial = roundToTwo(principal);
  let totalCapital = 0;
  let totalIntereses = 0;
  let totalCargos = 0;
  let totalPagar = 0;

  for (let index = 1; saldoInicial > 0; index++) {
    if (index > MAX_PERIODS) {
      throw new Error('La cuota no alcanza para cubrir los intereses del crédito.');
    }

    const numeroCuota = firstNumber + index - 1;
    const interes = roundToTwo(saldoInicial * periodRate);

    let capital = roundToTwo(capitalFor(numeroCuota, saldoInicial, interes));
    const isLast = (periods !== null && index === periods) || capital >= saldoInicial;
    if (isLast) {
      // La última cuota paga todo el saldo, lo que ajusta los centavos de redondeo
      capital = saldoInicial;
    }
    if (capital <= 0 && periods === null) {
      throw new Error('La cuota no alcanza para cubrir los intereses del crédito.');
    }

    const cuota = roundToTwo(capital + interes);
    const saldoFinal = isLast ? 0 : roundToTwo(saldoInicial - capital);
    const cargosCuota = periodicCharges.forInstallment({
      principal: base,
      saldoInicial,
      cuota,
      monthsPerPeriod,
    });
    const totalPago = roundToTwo(cuota + cargosCuota);

    totalCapital = roundToTwo(totalCapital + capital);
    totalIntereses = roundToTwo(totalIntereses + interes);
    totalCargos = roundToTwo(totalCargos + cargosCuota);
    totalPagar = roundToTwo(totalPagar + totalPago);

    rows.push({
      numeroCuota,
      // Mismo día cada período (o el último día si el mes es más corto)
      fechaPago: addMonthsClamped(fechaBase, numeroCuota * monthsPerPeriod),
      saldoInicial,
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
    rows,
    totalCapital,
    totalIntereses,
    totalCargos,
    totalPagar,
    cargosPeriodicos: periodicCharges.summary(),
  };
}

/**
 * Cuota constante del sistema francés: C = P · i(1+i)^n / ((1+i)^n - 1)
 */
function frenchInstallment(principal, periodRate, periods) {
  if (periodRate === 0) return principal / periods;
  const factor = Math.pow(1 + periodRate, periods);
  return principal * ((periodRate * factor) / (factor - 1));
}

module.exports = {
  MAX_PERIODS,
  buildSchedule,
  frenchInstallment,
};
