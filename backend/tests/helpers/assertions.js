/**
 * Funciones Auxiliares de Validación y Aserciones Financieras
 */

/**
 * Valida igualdad de valores monetarios con tolerancia en centavos
 * @param {number} actual - Valor obtenido
 * @param {number} expected - Valor esperado
 * @param {number} [tolerance=0.01] - Tolerancia máxima permitida (centavos)
 */
function expectCloseToMoney(actual, expected, tolerance = 0.01) {
  const diff = Math.abs(Number(actual) - Number(expected));
  if (diff > tolerance) {
    throw new Error(
      `Discrepancia monetaria: Obtenido ${actual}, Esperado ${expected}. Diferencia de ${diff.toFixed(4)} supera la tolerancia de ${tolerance}`
    );
  }
}

/**
 * Valida igualdad de tasas de interés con tolerancia de alta precisión
 * @param {number} actual - Tasa obtenida
 * @param {number} expected - Tasa esperada
 * @param {number} [tolerance=0.000001] - Tolerancia máxima
 */
function expectCloseToRate(actual, expected, tolerance = 0.000001) {
  const diff = Math.abs(Number(actual) - Number(expected));
  if (diff > tolerance) {
    throw new Error(
      `Discrepancia de tasa: Obtenido ${actual}, Esperado ${expected}. Diferencia de ${diff.toFixed(8)} supera la tolerancia de ${tolerance}`
    );
  }
}

/**
 * Comprueba invariantes matemáticas fundamentales en cualquier tabla de amortización
 * @param {Object} result - Objeto de simulación retornado por el motor
 * @param {number} principal - Monto original del crédito
 * @param {number} expectedTerms - Número de cuotas pactado
 */
function assertValidAmortizationTable(result, principal, expectedTerms) {
  expect(result).toBeDefined();
  expect(result.rows).toBeInstanceOf(Array);
  expect(result.rows.length).toBe(expectedTerms);

  const P = Number(principal);
  const rows = result.rows;

  // Invariante 1: Saldo inicial de la primera cuota es igual al principal
  expect(rows[0].saldoInicial).toBe(P);

  // Invariante 2: Saldo final de la última cuota es exactamente 0.00
  expect(rows[rows.length - 1].saldoFinal).toBe(0.00);

  // Invariante 3: La suma total de capital amortizado es igual al monto original (tolerancia centavos)
  expectCloseToMoney(result.totalCapital, P, 0.02);

  // Invariante 4: Ningún saldo ni componente es negativo
  let sumaCapital = 0;
  let sumaIntereses = 0;

  rows.forEach((row, idx) => {
    expect(row.numeroCuota).toBe(idx + 1);
    expect(row.saldoInicial).toBeGreaterThanOrEqual(0);
    expect(row.saldoFinal).toBeGreaterThanOrEqual(0);
    expect(row.capital).toBeGreaterThanOrEqual(0);
    expect(row.interes).toBeGreaterThanOrEqual(0);
    expect(row.cuota).toBeGreaterThanOrEqual(0);

    // Relación fundamental de la cuota: cuota = capital + interes
    expectCloseToMoney(row.cuota, row.capital + row.interes, 0.02);

    // Continuidad de saldos: saldo final = saldo inicial - capital
    expectCloseToMoney(row.saldoFinal, row.saldoInicial - row.capital, 0.02);

    if (idx < rows.length - 1) {
      // El saldo final del período actual es el saldo inicial del período siguiente
      expect(rows[idx + 1].saldoInicial).toBe(row.saldoFinal);
    }

    sumaCapital += row.capital;
    sumaIntereses += row.interes;
  });

  // Verificación de sumatorias globales
  expectCloseToMoney(result.totalCapital, sumaCapital, 0.02);
  expectCloseToMoney(result.totalIntereses, sumaIntereses, 0.02);
}

module.exports = {
  expectCloseToMoney,
  expectCloseToRate,
  assertValidAmortizationTable,
};
