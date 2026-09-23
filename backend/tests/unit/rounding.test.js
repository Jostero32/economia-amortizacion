/**
 * Pruebas Unitarias - Redondeo, Precisión de Centavos y Ajuste de Última Cuota
 * Evita errores acumulativos por cálculo de punto flotante en tablas de amortización.
 */

const { calculateFrenchAmortization, roundToTwo } = require('../../src/services/amortization/french');
const { calculateGermanAmortization } = require('../../src/services/amortization/german');
const { expectCloseToMoney } = require('../helpers/assertions');

describe('Control de Redondeo y Precisión Monetaria (2 Decimales / Centavos)', () => {
  // =========================================================================
  // FUNCIÓN AUXILIAR DE REDONDEO A 2 DECIMALES
  // =========================================================================
  describe('Función roundToTwo', () => {
    test('redondea correctamente centavos estándar con Number.EPSILON para evitar sesgos IEEE-754', () => {
      expect(roundToTwo(10.254)).toBe(10.25);
      expect(roundToTwo(10.255)).toBe(10.26);
      expect(roundToTwo(1.005)).toBe(1.01);
      expect(roundToTwo(0.000001)).toBe(0.00);
    });

    test('mantiene la precisión en sumas con centavos fraccionarios', () => {
      const a = 0.1;
      const b = 0.2;
      // En JS puro: 0.1 + 0.2 === 0.30000000000000004
      expect(a + b).not.toBe(0.3);
      expect(roundToTwo(a + b)).toBe(0.3);
    });
  });

  // =========================================================================
  // AJUSTE DE LA ÚLTIMA CUOTA (SECCIÓN 14)
  // Capital = 1000, Tasa mensual = 1%, Plazo = 3 meses
  // =========================================================================
  describe('Ajuste de Última Cuota en Sistema Francés (1,000 USD / 1% mensual / 3 meses)', () => {
    let result;

    beforeAll(() => {
      result = calculateFrenchAmortization({
        principal: 1000,
        monthlyRate: 0.01,
        termMonths: 3,
      });
    });

    test('todas las cifras intermedias y finales deben tener como máximo 2 decimales', () => {
      result.rows.forEach(row => {
        const capitalStr = row.capital.toString();
        const interesStr = row.interes.toString();
        const cuotaStr = row.cuota.toString();
        const saldoStr = row.saldoFinal.toString();

        if (capitalStr.includes('.')) expect(capitalStr.split('.')[1].length).toBeLessThanOrEqual(2);
        if (interesStr.includes('.')) expect(interesStr.split('.')[1].length).toBeLessThanOrEqual(2);
        if (cuotaStr.includes('.')) expect(cuotaStr.split('.')[1].length).toBeLessThanOrEqual(2);
        if (saldoStr.includes('.')) expect(saldoStr.split('.')[1].length).toBeLessThanOrEqual(2);
      });
    });

    test('la última cuota absorbe cualquier residuo de centavos para dejar saldo final exactamente en 0.00', () => {
      const ultimaFila = result.rows[2];
      expect(Math.abs(ultimaFila.saldoFinal)).toBeLessThanOrEqual(0.01);
      expect(ultimaFila.saldoFinal).toBe(0.00);
    });

    test('la sumatoria de todos los capitales amortizados coincide exactamente con el monto original (1,000 USD)', () => {
      const sumaCapital = result.rows.reduce((acc, r) => acc + r.capital, 0);
      expect(roundToTwo(sumaCapital)).toBe(1000.00);
      expect(result.totalCapital).toBe(1000.00);
    });
  });

  // =========================================================================
  // CRÉDITOS CON MONTOS Y TASAS DE ALTA FRACCIÓN (CENTAVOS IRREGULARES)
  // Ej: 13,745.83 USD al 15.3489% TEA a 17 meses
  // =========================================================================
  describe('Prueba de Estrés Numérico con Cifras No Enteras (13,745.83 USD / 17 meses)', () => {
    const P = 13745.83;
    const i = 0.01187492; // Tasa mensual con 8 decimales
    const n = 17;

    test('en Sistema Francés, el saldo final es 0.00 y la suma de capital es 13,745.83', () => {
      const res = calculateFrenchAmortization({ principal: P, monthlyRate: i, termMonths: n });
      expect(res.rows[n - 1].saldoFinal).toBe(0.00);
      expectCloseToMoney(res.totalCapital, P, 0.01);
    });

    test('en Sistema Alemán, el saldo final es 0.00 y la suma de capital es 13,745.83', () => {
      const res = calculateGermanAmortization({ principal: P, monthlyRate: i, termMonths: n });
      expect(res.rows[n - 1].saldoFinal).toBe(0.00);
      expectCloseToMoney(res.totalCapital, P, 0.01);
    });
  });
});
