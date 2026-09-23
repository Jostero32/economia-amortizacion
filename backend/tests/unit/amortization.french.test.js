/**
 * Pruebas Unitarias - Motor Financiero: Sistema Francés (Cuotas Constantes)
 * Verifica exactitud matemática, ajuste de última cuota y propiedades invariantes.
 */

const { calculateFrenchAmortization } = require('../../src/services/amortization/french');
const CREDIT_CASES = require('../fixtures/creditCases');
const { expectCloseToMoney, assertValidAmortizationTable } = require('../helpers/assertions');

describe('Motor Financiero - Sistema Francés (Amortización a Cuota Constante)', () => {
  // =========================================================================
  // CASO FRANCÉS 1: 10,000 USD / 12% Anual Nominal (1% mensual) / 12 meses
  // =========================================================================
  describe('Caso 1: Crédito 10,000 USD a 12 meses con tasa mensual del 1% (Sin cargos)', () => {
    const { monto, tasaMensual, plazoMeses, esperado } = CREDIT_CASES.FRENCH_10K_12PCT_12M;
    let result;

    beforeAll(() => {
      result = calculateFrenchAmortization({
        principal: monto,
        monthlyRate: tasaMensual,
        termMonths: plazoMeses,
      });
    });

    test('debe generar exactamente 12 cuotas mensuales', () => {
      expect(result.rows).toHaveLength(esperado.cantidadCuotas);
    });

    test('la primera cuota debe ser aproximadamente 888.49 USD', () => {
      expectCloseToMoney(result.rows[0].cuota, esperado.cuotaMensualAprox, 0.05);
      expectCloseToMoney(result.cuotaInicial, esperado.cuotaMensualAprox, 0.05);
    });

    test('el saldo inicial del período 1 debe ser exactamente 10,000 USD', () => {
      expect(result.rows[0].saldoInicial).toBe(esperado.saldoInicial);
    });

    test('el interés del primer período debe ser exactamente 100.00 USD (10,000 * 0.01)', () => {
      expect(result.rows[0].interes).toBe(esperado.primerInteres);
    });

    test('el capital amortizado del primer período debe ser aproximadamente 788.49 USD (888.49 - 100)', () => {
      expectCloseToMoney(result.rows[0].capital, esperado.primerCapital, 0.05);
    });

    test('el saldo pendiente tras la primera cuota debe ser aproximadamente 9,211.51 USD', () => {
      expectCloseToMoney(result.rows[0].saldoFinal, esperado.saldoDespuesCuota1, 0.05);
    });

    test('la sumatoria de capital amortizado debe ser exactamente 10,000 USD', () => {
      expectCloseToMoney(result.totalCapital, esperado.totalCapital, 0.01);
    });

    test('el interés total pagado debe ser aproximadamente 661.85 USD', () => {
      expectCloseToMoney(result.totalIntereses, esperado.totalInteresAprox, 0.50);
    });

    test('el saldo final de la última cuota (mes 12) debe ser exactamente 0.00 USD', () => {
      expect(result.rows[11].saldoFinal).toBe(0.00);
    });

    test('cumple todas las invariantes matemáticas de una tabla de amortización válida', () => {
      assertValidAmortizationTable(result, monto, plazoMeses);
    });
  });

  // =========================================================================
  // CASO FRANCÉS 2: Caso Límite Tasa Cero (i = 0)
  // Permite detectar errores de división por cero en la fórmula tradicional
  // =========================================================================
  describe('Caso 2: Caso Límite con Tasa Cero (1,000 USD / 0% tasa / 10 meses)', () => {
    const { monto, tasaMensual, plazoMeses, esperado } = CREDIT_CASES.FRENCH_1K_0PCT_10M;
    let result;

    beforeAll(() => {
      result = calculateFrenchAmortization({
        principal: monto,
        monthlyRate: tasaMensual,
        termMonths: plazoMeses,
      });
    });

    test('debe calcular la cuota exactamente como P / n = 100.00 USD', () => {
      expect(result.rows[0].cuota).toBe(esperado.cuotaMensual);
      expect(result.cuotaInicial).toBe(esperado.cuotaMensual);
    });

    test('el interés total acumulado debe ser exactamente 0.00 USD', () => {
      expect(result.totalIntereses).toBe(esperado.totalInteres);
    });

    test('cada cuota debe amortizar exactamente 100.00 USD a capital sin interés', () => {
      result.rows.forEach(row => {
        expect(row.interes).toBe(0.00);
        expect(row.capital).toBe(100.00);
        expect(row.cuota).toBe(100.00);
      });
    });

    test('el saldo final debe ser exactamente 0.00 USD', () => {
      expect(result.rows[result.rows.length - 1].saldoFinal).toBe(0.00);
    });

    test('el total pagado debe ser exactamente igual al capital original (1,000 USD)', () => {
      expect(result.totalPagar).toBe(esperado.totalPagar);
    });
  });

  // =========================================================================
  // CASO FRANCÉS 3: Tabla Detallada Independiente (5,000 USD / 1% / 6 meses)
  // =========================================================================
  describe('Caso 3: Comparación contra Tabla de Referencia Externa (5,000 USD / 1% / 6 meses)', () => {
    const { monto, tasaMensual, plazoMeses, esperado } = CREDIT_CASES.FRENCH_5K_1PCT_6M;
    let result;

    beforeAll(() => {
      result = calculateFrenchAmortization({
        principal: monto,
        monthlyRate: tasaMensual,
        termMonths: plazoMeses,
      });
    });

    test('comprueba cada fila período a período contra la proyección de referencia', () => {
      expect(result.rows).toHaveLength(6);
      esperado.filas.forEach((filaEsperada, idx) => {
        const filaReal = result.rows[idx];
        expect(filaReal.numeroCuota).toBe(filaEsperada.cuota);
        expectCloseToMoney(filaReal.saldoInicial, filaEsperada.saldoInicial, 0.02);
        expectCloseToMoney(filaReal.interes, filaEsperada.interes, 0.02);
        expectCloseToMoney(filaReal.capital, filaEsperada.capital, 0.02);
        expectCloseToMoney(filaReal.cuota, filaEsperada.cuotaTotal, 0.02);
        expectCloseToMoney(filaReal.saldoFinal, filaEsperada.saldoFinal, 0.02);
      });
    });

    test('el interés total coincide con el cálculo de referencia (176.44 USD)', () => {
      expectCloseToMoney(result.totalIntereses, esperado.totalInteres, 0.05);
    });

    test('el saldo final es 0.00 USD', () => {
      expect(result.rows[5].saldoFinal).toBe(0.00);
    });
  });

  // =========================================================================
  // VALIDACIONES DE ENTRADA Y MANEJO DE ERRORES
  // =========================================================================
  describe('Control de Errores y Validaciones del Sistema Francés', () => {
    test('lanza error si el capital es menor o igual a cero', () => {
      expect(() => {
        calculateFrenchAmortization({ principal: 0, monthlyRate: 0.01, termMonths: 12 });
      }).toThrow('El monto del crédito debe ser mayor a cero.');

      expect(() => {
        calculateFrenchAmortization({ principal: -500, monthlyRate: 0.01, termMonths: 12 });
      }).toThrow('El monto del crédito debe ser mayor a cero.');
    });

    test('lanza error si el plazo en meses no es un entero positivo', () => {
      expect(() => {
        calculateFrenchAmortization({ principal: 1000, monthlyRate: 0.01, termMonths: 0 });
      }).toThrow('El plazo en meses debe ser un entero positivo mayor a cero.');

      expect(() => {
        calculateFrenchAmortization({ principal: 1000, monthlyRate: 0.01, termMonths: 5.5 });
      }).toThrow('El plazo en meses debe ser un entero positivo mayor a cero.');
    });

    test('lanza error si la tasa periódica mensual es negativa', () => {
      expect(() => {
        calculateFrenchAmortization({ principal: 1000, monthlyRate: -0.01, termMonths: 12 });
      }).toThrow('La tasa de interés no puede ser negativa.');
    });
  });
});
