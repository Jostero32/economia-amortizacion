/**
 * Calculadora de Rendimiento para Depósitos a Plazo Fijo (Ecuador)
 *
 * Fórmula de interés simple comercial (base 360 días):
 * interes = capital * (tasaAnual / 100) * (dias / 360)
 * valorFinal = capital + interes
 */

function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el rendimiento didáctico de una inversión
 * @param {Object} params
 * @param {number} params.amount - Capital invertido en dólares
 * @param {number} params.termDays - Plazo en días
 * @param {number} params.annualRate - Tasa nominal referencial anual en porcentaje (ej: 5.09)
 * @param {string|Date} [params.startDate] - Fecha de inicio
 * @returns {Object} Resumen del cálculo
 */
function calculateInvestment({ amount, termDays, annualRate, startDate = new Date().toISOString().split('T')[0] }) {
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

  const baseDate = new Date(startDate);
  const fechaVencimiento = new Date(baseDate);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + dias);

  // Rendimiento financiero base 360 días
  const tasaDecimal = tasa / 100;
  const interesGanado = roundToTwo(capital * tasaDecimal * (dias / 360));
  const valorFinal = roundToTwo(capital + interesGanado);

  return {
    capital: roundToTwo(capital),
    plazoDias: dias,
    tasaAnual: tasa,
    interesGanado,
    valorFinal,
    fechaInicio: startDate,
    fechaVencimiento: fechaVencimiento.toISOString().split('T')[0],
    nota: 'Simulación didáctica de carácter informativo. Los valores reales pueden variar según la política de la institución.',
  };
}

module.exports = {
  calculateInvestment,
  roundToTwo,
};
