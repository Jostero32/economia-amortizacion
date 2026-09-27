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

module.exports = {
  roundToTwo,
};
