const { calculateFrenchAmortization } = require('./french');
const { calculateGermanAmortization } = require('./german');

/**
 * Convierte una Tasa Efectiva Anual (TEA) a Tasa Periódica Mensual
 * utilizando la fórmula de año financiero/comercial ecuatoriano (360 días):
 *
 * iMensual = (1 + iAnual)^(30 / 360) - 1
 *
 * @param {number} annualRate - Tasa en porcentaje (ej: 15.74) o decimal (ej: 0.1574)
 * @returns {number} Tasa mensual periódica con precisión de punto flotante
 */
function annualEffectiveToMonthlyRate(annualRate) {
  const iAnual = annualRate > 1 ? Number(annualRate) / 100 : Number(annualRate);
  if (iAnual < 0) {
    throw new Error('La tasa no puede ser negativa.');
  }
  return Math.pow(1 + iAnual, 30 / 360) - 1;
}

/**
 * Orquestador de amortización financiera
 * @param {Object} params
 * @param {number} params.amount - Monto del crédito
 * @param {number} params.termMonths - Plazo en meses
 * @param {number} params.annualRate - Tasa activa efectiva anual (porcentaje, ej: 15.74)
 * @param {string} params.system - 'FRANCES' o 'ALEMAN'
 * @param {string|Date} [params.startDate] - Fecha de inicio
 * @param {Array} [params.charges] - Lista de cobros adicionales configurados
 * @returns {Object} Resultado de la simulación
 */
function calculateAmortization({
  amount,
  termMonths,
  annualRate,
  system = 'FRANCES',
  startDate = new Date().toISOString().split('T')[0],
  charges = [],
}) {
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

  // Conversión formal de tasa efectiva anual a mensual
  const monthlyRate = annualEffectiveToMonthlyRate(tasaAnual);

  let simulationResult;
  if (sysUpper === 'FRANCES') {
    simulationResult = calculateFrenchAmortization({
      principal,
      monthlyRate,
      termMonths: n,
      startDate,
      charges,
    });
  } else {
    simulationResult = calculateGermanAmortization({
      principal,
      monthlyRate,
      termMonths: n,
      startDate,
      charges,
    });
  }

  return {
    ...simulationResult,
    tasaAnual,
    tasaMensual: monthlyRate,
    fechaInicio: startDate,
  };
}

module.exports = {
  annualEffectiveToMonthlyRate,
  calculateAmortization,
};
