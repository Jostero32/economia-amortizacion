const { calculateFrenchAmortization } = require('./french');
const { calculateGermanAmortization } = require('./german');
const { todayISO, toISODate } = require('../../utils/dates');
const { roundToTwo } = require('../../utils/money');
const { calculateDisbursementCharges } = require('./charges');
const { getFrequency, effectiveToPeriodicRate } = require('./frequencies');

/**
 * Convierte una Tasa Efectiva Anual (TEA) a Tasa Periódica Mensual
 * utilizando la fórmula de año financiero/comercial ecuatoriano (360 días):
 *
 * iMensual = (1 + iAnual)^(30 / 360) - 1
 *
 * @param {number} annualRate - Tasa en porcentaje (ej: 15.74). Siempre se interpreta como
 *   porcentaje: 0.9 significa 0.9 % anual, no 90 %.
 * @returns {number} Tasa mensual periódica con precisión de punto flotante
 */
function annualEffectiveToMonthlyRate(annualRate) {
  const iAnual = Number(annualRate) / 100;
  if (iAnual < 0) {
    throw new Error('La tasa no puede ser negativa.');
  }
  return Math.pow(1 + iAnual, 30 / 360) - 1;
}

/**
 * Tasa nominal anual equivalente a una TEA para pagos cada `days` días.
 * Instructivo de Tasas de Interés del BCE, Anexo 1:
 *
 * TEA = [1 + i·n/360]^(360/n) - 1  =>  i = (360/n)·[(1 + TEA)^(n/360) - 1]
 *
 * @param {number} effectiveRate - TEA en porcentaje
 * @param {number} [days=30] - Días del período de pago (30 = mensual)
 * @returns {number} Tasa nominal anual en porcentaje
 */
function effectiveToNominalRate(effectiveRate, days = 30) {
  const tea = Number(effectiveRate) / 100;
  return (360 / days) * (Math.pow(1 + tea, days / 360) - 1) * 100;
}

/**
 * TEA correspondiente a una tasa nominal anual con pagos cada `days` días
 * (Instructivo de Tasas de Interés del BCE, Anexo 1).
 *
 * @param {number} nominalRate - Tasa nominal anual en porcentaje
 * @param {number} [days=30] - Días del período de pago (30 = mensual)
 * @returns {number} TEA en porcentaje
 */
function nominalToEffectiveRate(nominalRate, days = 30) {
  const i = Number(nominalRate) / 100;
  return (Math.pow(1 + (i * days) / 360, 360 / days) - 1) * 100;
}

/**
 * Costo efectivo anual para el cliente (informativo).
 *
 * Es la TIR por período de los flujos reales -lo que recibe al desembolso y lo que paga en cada
 * cuota, incluidos seguros e impuestos- expresada en términos anuales: (1 + TIR)^(períodos por año) - 1.
 * A diferencia de la TEA legal, incluye SOLCA y seguros, por eso es mayor.
 *
 * @param {number} montoLiquido - Valor entregado al cliente
 * @param {Array<number>} pagos - Pago total de cada cuota
 * @param {number} [periodsPerYear=12] - Cuotas por año (12 mensual, 4 trimestral, 2 semestral)
 * @returns {number} Porcentaje anual
 */
function calculateAnnualCostRate(montoLiquido, pagos, periodsPerYear = 12) {
  const npv = (rate) => pagos.reduce(
    (sum, pago, index) => sum - pago / Math.pow(1 + rate, index + 1),
    montoLiquido
  );

  // Si lo pagado no supera lo recibido, el costo es nulo
  if (npv(0) >= 0) return 0;

  let low = 0;
  let high = 0.1;
  while (npv(high) < 0 && high < 100) high *= 2;

  for (let iteration = 0; iteration < 200; iteration++) {
    const mid = (low + high) / 2;
    if (npv(mid) < 0) low = mid;
    else high = mid;
  }
  return (Math.pow(1 + (low + high) / 2, periodsPerYear) - 1) * 100;
}

/**
 * Orquestador de amortización financiera
 * @param {Object} params
 * @param {number} params.amount - Monto del crédito
 * @param {number} params.termMonths - Plazo en meses
 * @param {number} params.annualRate - Tasa activa efectiva anual (TEA, porcentaje, ej: 15.74)
 * @param {string} params.system - 'FRANCES' o 'ALEMAN'
 * @param {string} [params.startDate] - Fecha de desembolso (YYYY-MM-DD), por defecto hoy en Ecuador
 * @param {Array} [params.charges] - Cargos que aplican a la operación (ver ./charges.js)
 * @param {string} [params.paymentFrequency='MENSUAL'] - MENSUAL, BIMESTRAL, TRIMESTRAL o SEMESTRAL
 * @returns {Object} Resultado de la simulación
 */
function calculateAmortization({
  amount,
  termMonths,
  annualRate,
  system = 'FRANCES',
  startDate,
  charges = [],
  paymentFrequency = 'MENSUAL',
}) {
  const fechaInicio = startDate ? toISODate(startDate) : todayISO();
  const principal = Number(amount);
  const n = parseInt(termMonths, 10);
  const tasaAnual = Number(annualRate);

  if (isNaN(principal) || principal <= 0) {
    throw new Error('El monto debe ser un número positivo mayor a 0.');
  }
  if (isNaN(n) || n <= 0) {
    throw new Error('El plazo en meses debe ser un número entero mayor a 0.');
  }
  if (isNaN(tasaAnual) || tasaAnual < 0) {
    throw new Error('La tasa de interés debe ser un número válido mayor o igual a 0.');
  }

  const sysUpper = (system || 'FRANCES').toUpperCase().trim();
  if (sysUpper !== 'FRANCES' && sysUpper !== 'ALEMAN') {
    throw new Error(`Sistema de amortización no válido: '${system}'. Utilice FRANCES o ALEMAN.`);
  }

  const frecuencia = getFrequency(paymentFrequency);
  if (n % frecuencia.meses !== 0) {
    throw new Error(
      `Con pagos de frecuencia ${frecuencia.cuota} el plazo debe ser múltiplo de ${frecuencia.meses} meses.`
    );
  }

  // Conversión formal de la tasa efectiva anual a la tasa del período de pago
  const monthlyRate = annualEffectiveToMonthlyRate(tasaAnual);
  const periodRate = effectiveToPeriodicRate(tasaAnual, frecuencia.dias);

  const calculate = sysUpper === 'FRANCES' ? calculateFrenchAmortization : calculateGermanAmortization;
  const simulationResult = calculate({
    principal,
    monthlyRate: periodRate,
    termMonths: n,
    monthsPerPeriod: frecuencia.meses,
    startDate: fechaInicio,
    charges,
  });

  // Cargos al desembolso (SOLCA, gastos a terceros): se descuentan del monto entregado
  const cargosDesembolsoDetalle = calculateDisbursementCharges(charges, { principal, termMonths: n });
  const cargosDesembolso = roundToTwo(
    cargosDesembolsoDetalle.reduce((sum, cargo) => sum + cargo.valor, 0)
  );
  const montoLiquido = roundToTwo(principal - cargosDesembolso);

  return {
    ...simulationResult,
    // Cargos periódicos + cargos al desembolso
    totalCargos: roundToTwo(simulationResult.totalCargos + cargosDesembolso),
    cargosDesembolso,
    montoLiquido,
    desgloseCargos: [...cargosDesembolsoDetalle, ...simulationResult.cargosPeriodicos],
    tasaAnual,
    // La tasa nominal del contrato depende de la frecuencia de pago (BCE, Anexo 1)
    tasaNominal: effectiveToNominalRate(tasaAnual, frecuencia.dias),
    tasaMensual: monthlyRate,
    tasaPeriodica: periodRate,
    frecuenciaPago: frecuencia.codigo,
    numeroCuotas: simulationResult.rows.length,
    costoEfectivoAnual: calculateAnnualCostRate(
      montoLiquido,
      simulationResult.rows.map((row) => row.totalPago),
      12 / frecuencia.meses
    ),
    fechaInicio,
  };
}

module.exports = {
  annualEffectiveToMonthlyRate,
  effectiveToNominalRate,
  nominalToEffectiveRate,
  calculateAnnualCostRate,
  calculateAmortization,
};
