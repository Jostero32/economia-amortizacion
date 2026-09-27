/**
 * Abono extraordinario (pago anticipado parcial o total).
 *
 * La ley prohíbe cobrar penalidades por pagos anticipados y el cliente decide si el abono reduce el
 * plazo o el valor de la cuota. El abono se aplica al saldo de capital luego de la cuota indicada:
 * - REDUCIR_PLAZO: se mantiene la cuota (francés) o la amortización de capital (alemán) y se
 *   pagan menos cuotas.
 * - REDUCIR_CUOTA: se mantiene el número de cuotas restantes y se recalcula una cuota menor.
 */

const { roundToTwo } = require('../../utils/money');
const { buildSchedule, frenchInstallment } = require('./schedule');

const PREPAYMENT_OPTIONS = ['REDUCIR_PLAZO', 'REDUCIR_CUOTA'];

function summarize(rows) {
  const sum = (field) => roundToTwo(rows.reduce((total, row) => total + Number(row[field] || 0), 0));
  return {
    cuotas: rows.length,
    primeraCuota: rows[0] ? Number(rows[0].totalPago) : 0,
    ultimaFecha: rows.length ? rows[rows.length - 1].fechaPago : null,
    interesesRestantes: sum('interes'),
    segurosRestantes: sum('cargos'),
    totalRestante: sum('totalPago'),
  };
}

/**
 * @param {Object} params
 * @param {Array} params.rows - Tabla de amortización original ordenada por cuota
 * @param {'FRANCES'|'ALEMAN'} params.system
 * @param {number} params.principal - Monto original del crédito (base de cargos sobre el monto)
 * @param {number} params.periodRate - Tasa del período en decimal
 * @param {number} params.monthsPerPeriod - Meses entre cuotas
 * @param {string} params.startDate - Fecha de desembolso del crédito
 * @param {Array} params.charges - Cargos periódicos del crédito
 * @param {number} params.afterInstallment - Cuota luego de la cual se abona (0 = antes de la primera)
 * @param {number} params.amount - Valor del abono
 * @param {'REDUCIR_PLAZO'|'REDUCIR_CUOTA'} params.option
 * @returns {Object} Comparación entre el cronograma original restante y el nuevo
 */
function simulatePrepayment({
  rows,
  system,
  principal,
  periodRate,
  monthsPerPeriod = 1,
  startDate,
  charges = [],
  afterInstallment,
  amount,
  option,
}) {
  const totalCuotas = rows.length;
  const k = Number(afterInstallment);
  const abono = roundToTwo(Number(amount));

  if (!PREPAYMENT_OPTIONS.includes(option)) {
    throw new Error('Elige si el abono reduce el plazo o la cuota.');
  }
  if (!Number.isInteger(k) || k < 0 || k >= totalCuotas) {
    throw new Error(`Elige una cuota entre 0 y ${totalCuotas - 1}.`);
  }

  const saldoAntes = k === 0 ? roundToTwo(principal) : Number(rows[k - 1].saldoFinal);
  if (!(abono > 0)) {
    throw new Error('El abono debe ser mayor a $0.');
  }
  if (abono > saldoAntes) {
    throw new Error(`El abono no puede superar el saldo de capital en ese momento ($${saldoAntes.toFixed(2)}).`);
  }

  const original = summarize(rows.slice(k));
  const saldoDespues = roundToTwo(saldoAntes - abono);
  const cuotasRestantes = totalCuotas - k;

  let newRows = [];
  if (saldoDespues > 0) {
    let capitalFor;
    let periods;

    if (option === 'REDUCIR_CUOTA') {
      periods = cuotasRestantes;
      if (system === 'FRANCES') {
        const cuota = roundToTwo(frenchInstallment(saldoDespues, periodRate, periods));
        capitalFor = (numero, saldo, interes) => cuota - interes;
      } else {
        const amortizacion = roundToTwo(saldoDespues / periods);
        capitalFor = () => amortizacion;
      }
    } else {
      // Reducir plazo: se paga lo mismo que antes hasta saldar la deuda
      periods = null;
      if (system === 'FRANCES') {
        const cuota = Number(rows[k].cuota);
        capitalFor = (numero, saldo, interes) => cuota - interes;
      } else {
        const amortizacion = Number(rows[0].capital);
        capitalFor = () => amortizacion;
      }
    }

    newRows = buildSchedule({
      principal: saldoDespues,
      periodRate,
      periods,
      capitalFor,
      monthsPerPeriod,
      startDate,
      firstNumber: k + 1,
      chargeBase: principal,
      charges,
    }).rows;
  }

  const nuevo = summarize(newRows);
  return {
    opcion: option,
    despuesDeCuota: k,
    abono,
    saldoAntes,
    saldoDespues,
    original,
    nuevo: { ...nuevo, rows: newRows },
    cuotasMenos: original.cuotas - nuevo.cuotas,
    ahorroIntereses: roundToTwo(original.interesesRestantes - nuevo.interesesRestantes),
    // Lo que deja de pagar en total: intereses y seguros que ya no se generan
    ahorroTotal: roundToTwo(original.totalRestante - (abono + nuevo.totalRestante)),
  };
}

module.exports = {
  PREPAYMENT_OPTIONS,
  simulatePrepayment,
};
