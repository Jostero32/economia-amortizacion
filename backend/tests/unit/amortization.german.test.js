/**
 * Pruebas Unitarias - Motor Financiero: Sistema Alemán (Amortización Constante)
 * y Comparación Matemática Francés vs Alemán
 */

const { calculateGermanAmortization } = require('../../src/services/amortization/german');
const { calculateFrenchAmortization } = require('../../src/services/amortization/french');
const CREDIT_CASES = require('../fixtures/creditCases');
const { expectCloseToMoney, assertValidAmortizationTable } = require('../helpers/assertions');

describe('Motor Financiero - Sistema Alemán (Amortización Constante a Capital)', () => {
  // =========================================================================
  // CASO ALEMÁN: 12,000 USD / 1% mensual / 12 meses
  // =========================================================================
  describe('Caso Alemán: 12,000 USD a 12 meses con tasa mensual del 1%', () => {
    const { monto, tasaMensual, plazoMeses, esperado } = CREDIT_CASES.GERMAN_12K_1PCT_12M;
    let result;

    beforeAll(() => {
      result = calculateGermanAmortization({
        principal: monto,
        monthlyRate: tasaMensual,
        termMonths: plazoMeses,
      });
    });

    test('la amortización de capital debe ser constante en cada período (1,000 USD)', () => {
      expect(result.rows).toHaveLength(12);
      result.rows.forEach(row => {
        expect(row.capital).toBe(esperado.amortizacionConstante);
      });
    });

    test('la primera cuota debe ser 1,120.00 USD (1,000 capital + 120 interés)', () => {
      expect(result.rows[0].cuota).toBe(esperado.primeraCuota);
      expect(result.cuotaInicial).toBe(esperado.primeraCuota);
    });

    test('la segunda cuota debe ser 1,110.00 USD (1,000 capital + 110 interés)', () => {
      expect(result.rows[1].cuota).toBe(esperado.segundaCuota);
    });

    test('la tercera cuota debe ser 1,100.00 USD (1,000 capital + 100 interés)', () => {
      expect(result.rows[2].cuota).toBe(esperado.terceraCuota);
    });

    test('la última cuota (período 12) debe ser 1,010.00 USD (1,000 capital + 10 interés)', () => {
      expect(result.rows[11].cuota).toBe(esperado.ultimaCuota);
    });

    test('las cuotas deben ser estrictamente decrecientes mes a mes (cuota_k > cuota_k+1)', () => {
      for (let k = 0; k < result.rows.length - 1; k++) {
        expect(result.rows[k].cuota).toBeGreaterThan(result.rows[k + 1].cuota);
      }
    });

    test('los intereses deben ser estrictamente decrecientes mes a mes', () => {
      for (let k = 0; k < result.rows.length - 1; k++) {
        expect(result.rows[k].interes).toBeGreaterThan(result.rows[k + 1].interes);
      }
    });

    test('el capital total amortizado debe ser exactamente 12,000 USD y el saldo final 0.00 USD', () => {
      expect(result.totalCapital).toBe(esperado.totalCapital);
      expect(result.rows[11].saldoFinal).toBe(0.00);
    });

    test('el interés total pagado debe ser exactamente 780.00 USD', () => {
      expect(result.totalIntereses).toBe(esperado.totalInteres);
    });

    test('el total pagado acumulado debe ser exactamente 12,780.00 USD', () => {
      expect(result.totalPagar).toBe(esperado.totalPagar);
    });

    test('cumple todas las invariantes matemáticas de una tabla de amortización válida', () => {
      assertValidAmortizationTable(result, monto, plazoMeses);
    });
  });

  // =========================================================================
  // COMPARACIÓN MATEMÁTICA: FRANCÉS VS ALEMÁN (Sección 9)
  // Mismos parámetros: 12,000 USD / 1% mensual / 12 meses
  // =========================================================================
  describe('Comparativa Matemática de Sistemas: Francés vs Alemán', () => {
    const P = 12000;
    const i = 0.01;
    const n = 12;

    let resFrances;
    let resAleman;

    beforeAll(() => {
      resFrances = calculateFrenchAmortization({ principal: P, monthlyRate: i, termMonths: n });
      resAleman = calculateGermanAmortization({ principal: P, monthlyRate: i, termMonths: n });
    });

    test('el sistema francés mantiene cuotas aproximadamente constantes mientras el alemán las reduce mes a mes', () => {
      // En francés, la diferencia entre la primera cuota y las intermedias es menor a centavos por redondeo
      const cuota1Frances = resFrances.rows[0].cuota;
      const cuota6Frances = resFrances.rows[5].cuota;
      expectCloseToMoney(cuota1Frances, cuota6Frances, 0.05);

      // En alemán, la primera cuota es significativamente mayor que la sexta
      const cuota1Aleman = resAleman.rows[0].cuota;
      const cuota6Aleman = resAleman.rows[5].cuota;
      expect(cuota1Aleman - cuota6Aleman).toBeCloseTo(50.00, 2);
    });

    test('ambos sistemas amortizan exactamente el capital original (12,000 USD)', () => {
      expectCloseToMoney(resFrances.totalCapital, P, 0.01);
      expectCloseToMoney(resAleman.totalCapital, P, 0.01);
    });

    test('ambos sistemas concluyen con un saldo deudor final de exactamente 0.00 USD', () => {
      expect(resFrances.rows[n - 1].saldoFinal).toBe(0.00);
      expect(resAleman.rows[n - 1].saldoFinal).toBe(0.00);
    });

    test('ambos sistemas calculan los intereses de cada período estrictamente sobre el saldo insoluto pendiente', () => {
      for (let k = 0; k < n; k++) {
        const interesEsperadoFrances = Math.round((resFrances.rows[k].saldoInicial * i + Number.EPSILON) * 100) / 100;
        const interesEsperadoAleman = Math.round((resAleman.rows[k].saldoInicial * i + Number.EPSILON) * 100) / 100;

        expect(resFrances.rows[k].interes).toBe(interesEsperadoFrances);
        expect(resAleman.rows[k].interes).toBe(interesEsperadoAleman);
      }
    });

    test('el sistema alemán genera un interés total acumulado menor debido a la amortización más rápida de capital en los primeros meses', () => {
      // Alemán: 780.00 USD vs Francés: ~794.22 USD
      expect(resAleman.totalIntereses).toBeLessThan(resFrances.totalIntereses);
    });
  });

  // =========================================================================
  // CONTROL DE ERRORES DEL SISTEMA ALEMÁN
  // =========================================================================
  describe('Control de Errores en Sistema Alemán', () => {
    test('lanza error si el monto es cero o negativo', () => {
      expect(() => {
        calculateGermanAmortization({ principal: 0, monthlyRate: 0.01, termMonths: 12 });
      }).toThrow('El monto del crédito debe ser mayor a cero.');

      expect(() => {
        calculateGermanAmortization({ principal: -1000, monthlyRate: 0.01, termMonths: 12 });
      }).toThrow('El monto del crédito debe ser mayor a cero.');
    });

    test('lanza error si el plazo no es un entero positivo', () => {
      expect(() => {
        calculateGermanAmortization({ principal: 5000, monthlyRate: 0.01, termMonths: 0 });
      }).toThrow('El plazo en meses debe ser un entero positivo mayor a cero.');

      expect(() => {
        calculateGermanAmortization({ principal: 5000, monthlyRate: 0.01, termMonths: -6 });
      }).toThrow('El plazo en meses debe ser un entero positivo mayor a cero.');
    });

    test('lanza error si la tasa mensual es negativa', () => {
      expect(() => {
        calculateGermanAmortization({ principal: 5000, monthlyRate: -0.01, termMonths: 12 });
      }).toThrow('La tasa de interés no puede ser negativa.');
    });
  });
});
