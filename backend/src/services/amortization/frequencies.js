/**
 * Frecuencias de pago de un crédito.
 *
 * La tasa del período sale de la TEA con la base comercial de 360 días:
 *   i_periodo = (1 + TEA)^(días/360) - 1
 * y la tasa nominal que se informa es i_periodo · 360/días (Instructivo de Tasas del BCE, Anexo 1).
 */

const PAYMENT_FREQUENCIES = {
  MENSUAL: { codigo: 'MENSUAL', meses: 1, dias: 30, label: 'Mensual', cuota: 'mensual' },
  BIMESTRAL: { codigo: 'BIMESTRAL', meses: 2, dias: 60, label: 'Bimestral', cuota: 'bimestral' },
  TRIMESTRAL: { codigo: 'TRIMESTRAL', meses: 3, dias: 90, label: 'Trimestral', cuota: 'trimestral' },
  SEMESTRAL: { codigo: 'SEMESTRAL', meses: 6, dias: 180, label: 'Semestral', cuota: 'semestral' },
};

const FREQUENCY_CODES = Object.keys(PAYMENT_FREQUENCIES);

function getFrequency(code = 'MENSUAL') {
  const frequency = PAYMENT_FREQUENCIES[String(code || 'MENSUAL').toUpperCase()];
  if (!frequency) {
    throw new Error(`Frecuencia de pago no válida: '${code}'. Opciones: ${FREQUENCY_CODES.join(', ')}.`);
  }
  return frequency;
}

/**
 * Tasa efectiva del período a partir de la TEA
 * @param {number} effectiveRate - TEA en porcentaje
 * @param {number} days - Días del período
 * @returns {number} Tasa del período en decimal
 */
function effectiveToPeriodicRate(effectiveRate, days) {
  const tea = Number(effectiveRate) / 100;
  if (tea < 0) {
    throw new Error('La tasa no puede ser negativa.');
  }
  return Math.pow(1 + tea, days / 360) - 1;
}

module.exports = {
  PAYMENT_FREQUENCIES,
  FREQUENCY_CODES,
  getFrequency,
  effectiveToPeriodicRate,
};
