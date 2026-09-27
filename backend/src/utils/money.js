/**
 * Utilidades monetarias (dólares con 2 decimales).
 */

/**
 * Redondea a centavos con criterio "mitad hacia arriba" (half-up), el usado en
 * liquidaciones bancarias.
 *
 * Se redondea desplazando el punto decimal en notación exponencial y no
 * multiplicando por 100: 10000.005 se representa en binario como
 * 10000.00499999..., y (x * 100) lo bajaría a 10000.00 en lugar de 10000.01.
 *
 * @param {number|string} num
 * @returns {number}
 */
function roundToTwo(num) {
  const value = Number(num);
  if (!Number.isFinite(value)) return value;

  const abs = Math.abs(value);
  // Por debajo de medio centavo el resultado siempre es 0 (y evita notación 1e-7)
  if (abs < 0.005) return 0;

  const rounded = Number(`${Math.round(Number(`${abs}e2`))}e-2`);
  return value < 0 ? -rounded : rounded;
}

const moneyFormatter = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Monto en dólares con la convención es-EC ($1.234,56), igual que el frontend
 */
function formatMoney(value) {
  const number = Number(value);
  return moneyFormatter.format(Number.isFinite(number) ? number : 0);
}

/**
 * Porcentaje con 2 decimales y coma decimal (15,74 %)
 */
function formatPercent(value, decimals = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toLocaleString('es-EC', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

module.exports = {
  roundToTwo,
  formatMoney,
  formatPercent,
};
