/**
 * Calculadora de Rendimiento para Depósitos a Plazo Fijo (Ecuador)
 *
 * Interés simple comercial (base 360 días), pago al vencimiento:
 * interesBruto = capital * (tasaNominal / 100) * (dias / 360)
 *
 * Retención en la fuente del Impuesto a la Renta sobre los intereses:
 * 3 % desde el 1-mar-2026 (Resolución SRI NAC-DGERCGC26-00000009). Exentos los
 * depósitos con plazo igual o superior a 180 días (LRTI, Art. 9, num. 15.1).
 *
 * valorFinal = capital + interesBruto - retencionIR
 */

const { roundToTwo } = require('../../utils/money');
const { addDays, todayISO, toISODate } = require('../../utils/dates');

const TASA_RETENCION_IR = 3.0;
const PLAZO_EXENTO_RETENCION_DIAS = 180;

/**
 * Tasa aplicable a un plazo según los tramos vigentes del producto.
 * Si ningún tramo cubre el plazo se usa la tasa base del producto.
 *
 * @param {Object} product - Producto con `tasa` y `rates` [{ plazoMinDias, plazoMaxDias, tasa, activo }]
 * @param {number} termDays - Plazo en días
 * @returns {number} Tasa nominal anual en porcentaje
 */
function resolveInvestmentRate(product, termDays) {
  const dias = Number(termDays);
  const rates = (product.rates || []).filter((rate) => rate.activo !== false);
  const matchRate = rates.find(
    (rate) => dias >= Number(rate.plazoMinDias) && dias <= Number(rate.plazoMaxDias)
  );
  return Number(matchRate ? matchRate.tasa : product.tasa);
}

/**
 * Calcula el rendimiento de una inversión a plazo fijo
 * @param {Object} params
 * @param {number} params.amount - Capital invertido en dólares
 * @param {number} params.termDays - Plazo en días
 * @param {number} params.annualRate - Tasa nominal anual en porcentaje (ej: 5.09)
 * @param {string} [params.startDate] - Fecha de apertura (YYYY-MM-DD), por defecto hoy en Ecuador
 * @returns {Object} Resumen del cálculo
 */
function calculateInvestment({ amount, termDays, annualRate, startDate }) {
  const capital = Number(amount);
  const dias = parseInt(termDays, 10);
  const tasa = Number(annualRate);

  if (isNaN(capital) || capital <= 0) {
    throw new Error('El monto de inversión debe ser mayor a 0.');
  }
  if (isNaN(dias) || dias <= 0) {
    throw new Error('El plazo en días debe ser un entero positivo mayor a 0.');
  }
  if (isNaN(tasa) || tasa < 0) {
    throw new Error('La tasa de interés debe ser un valor no negativo.');
  }

  const fechaInicio = startDate ? toISODate(startDate) : todayISO();
  const fechaVencimiento = addDays(fechaInicio, dias);

  // Rendimiento financiero base 360 días
  const interesGanado = roundToTwo(capital * (tasa / 100) * (dias / 360));

  const exentoRetencion = dias >= PLAZO_EXENTO_RETENCION_DIAS;
  const tasaRetencion = exentoRetencion ? 0 : TASA_RETENCION_IR;
  const retencionIR = roundToTwo(interesGanado * (tasaRetencion / 100));
  const interesNeto = roundToTwo(interesGanado - retencionIR);
  const valorFinal = roundToTwo(capital + interesNeto);

  // TEA del depósito con pago al vencimiento (BCE, Anexo 1: n = plazo en días)
  const tasaEfectiva = (Math.pow(1 + (tasa / 100) * (dias / 360), 360 / dias) - 1) * 100;

  return {
    capital: roundToTwo(capital),
    plazoDias: dias,
    tasaAnual: tasa,
    tasaEfectiva,
    interesGanado,
    exentoRetencion,
    tasaRetencion,
    retencionIR,
    interesNeto,
    valorFinal,
    fechaInicio,
    fechaVencimiento,
    nota: 'Simulación didáctica de carácter informativo. Los valores reales pueden variar según la política de la institución.',
  };
}

module.exports = {
  TASA_RETENCION_IR,
  PLAZO_EXENTO_RETENCION_DIAS,
  calculateInvestment,
  resolveInvestmentRate,
  roundToTwo,
};
