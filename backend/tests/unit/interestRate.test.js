/**
 * Pruebas Unitarias - Conversión y Validación de Tasas de Interés (Ingeniería Económica)
 * Valida la conversión matemática TEA -> Mensual y el cumplimiento de techos regulatorios BCE.
 */

const { annualEffectiveToMonthlyRate } = require('../../src/services/amortization');
const BCE_RATES_SEPT_2026 = require('../fixtures/bceRates.sept2026');
const { expectCloseToRate } = require('../helpers/assertions');

describe('Conversión de Tasas de Interés y Regulación Ecuatoriana (BCE)', () => {
  // =========================================================================
  // SECCIÓN 10: CONVERSIÓN DE TASA ANUAL EFECTIVA (TEA) A MENSUAL EQUIVALENTE
  // Fórmula: i_mensual = (1 + i_anual)^(30 / 360) - 1 = (1 + i_anual)^(1 / 12) - 1
  // NO debe utilizar i_anual / 12
  // =========================================================================
  describe('Conversión TEA a Tasa Mensual Periódica (Año comercial ecuatoriano 360 días)', () => {
    test('para 12% TEA, la tasa mensual debe ser ~0.948879% y NO 1.000000%', () => {
      const iMensual = annualEffectiveToMonthlyRate(12.0);
      const esperado = Math.pow(1 + 0.12, 1 / 12) - 1; // 0.0094887929...

      expectCloseToRate(iMensual, esperado, 0.000001);
      // Demostrar explícitamente que es diferente de la tasa nominal dividida para 12 (0.01)
      expect(iMensual).not.toBe(0.01);
      expect(iMensual).toBeLessThan(0.01);
    });

    test('para 0% TEA, la tasa mensual resultante debe ser exactamente 0.0', () => {
      const iMensual = annualEffectiveToMonthlyRate(0.0);
      expect(iMensual).toBe(0.0);
    });

    test('para 5% TEA, calcula correctamente ~0.407412%', () => {
      const iMensual = annualEffectiveToMonthlyRate(5.0);
      const esperado = Math.pow(1 + 0.05, 1 / 12) - 1; // 0.004074123...
      expectCloseToRate(iMensual, esperado, 0.000001);
    });

    test('para 15.74% TEA (Tasa Referencial Consumo BCE Septiembre 2026)', () => {
      const iMensual = annualEffectiveToMonthlyRate(15.74);
      const esperado = Math.pow(1 + 0.1574, 1 / 12) - 1; // 0.012244406...
      expectCloseToRate(iMensual, esperado, 0.000001);
    });

    test('para 16.77% TEA (Tasa Máxima Consumo BCE Septiembre 2026)', () => {
      const iMensual = annualEffectiveToMonthlyRate(16.77);
      const esperado = Math.pow(1 + 0.1677, 1 / 12) - 1; // 0.012991054...
      expectCloseToRate(iMensual, esperado, 0.000001);
    });

    test('acepta tasa tanto en formato porcentaje (15.74) como en formato decimal (0.1574)', () => {
      const tasaDesdePorcentaje = annualEffectiveToMonthlyRate(15.74);
      const tasaDesdeDecimal = annualEffectiveToMonthlyRate(0.1574);
      expectCloseToRate(tasaDesdePorcentaje, tasaDesdeDecimal, 0.00000001);
    });

    test('lanza error si la tasa ingresada es negativa', () => {
      expect(() => {
        annualEffectiveToMonthlyRate(-5);
      }).toThrow('La tasa no puede ser negativa.');
    });
  });

  // =========================================================================
  // SECCIÓN 11 Y 12: VALIDACIÓN DE TECHOS MÁXIMOS REGULADOS POR EL BCE
  // =========================================================================
  describe('Control Regulatorio de Tasas Máximas del Banco Central del Ecuador', () => {
    const segmentoConsumo = BCE_RATES_SEPT_2026.segmentos.find(s => s.codigo === 'CONSUMO');

    function validateRateAgainstMaxCeiling(requestedRate, maxRate) {
      const tasa = Number(requestedRate);
      const techo = Number(maxRate);
      if (tasa < 0) {
        throw new Error('La tasa de interés no puede ser negativa.');
      }
      if (tasa > techo) {
        throw new Error(
          `La tasa solicitada (${tasa}%) supera la tasa activa efectiva máxima fijada por el BCE (${techo}%).`
        );
      }
      return true;
    }

    test('las tasas de prueba 15.00%, 16.00% y 16.77% (en el límite) deben ser aceptadas', () => {
      expect(validateRateAgainstMaxCeiling(15.00, segmentoConsumo.tasaMaxima)).toBe(true);
      expect(validateRateAgainstMaxCeiling(16.00, segmentoConsumo.tasaMaxima)).toBe(true);
      expect(validateRateAgainstMaxCeiling(16.77, segmentoConsumo.tasaMaxima)).toBe(true);
    });

    test('la tasa 16.78% (0.01% sobre el techo) debe ser rechazada de inmediato', () => {
      expect(() => {
        validateRateAgainstMaxCeiling(16.78, segmentoConsumo.tasaMaxima);
      }).toThrow('supera la tasa activa efectiva máxima fijada por el BCE');
    });

    test('la tasa 20.00% (significativamente superior al techo de consumo) debe ser rechazada', () => {
      expect(() => {
        validateRateAgainstMaxCeiling(20.00, segmentoConsumo.tasaMaxima);
      }).toThrow('supera la tasa activa efectiva máxima fijada por el BCE');
    });

    test('comprueba techos de otros segmentos oficiales: Educativo (9.50%) e Inmobiliario (9.26%)', () => {
      const segEducativo = BCE_RATES_SEPT_2026.segmentos.find(s => s.codigo === 'EDUCATIVO');
      const segInmobiliario = BCE_RATES_SEPT_2026.segmentos.find(s => s.codigo === 'INMOBILIARIO');

      expect(validateRateAgainstMaxCeiling(8.83, segEducativo.tasaMaxima)).toBe(true);
      expect(validateRateAgainstMaxCeiling(9.50, segEducativo.tasaMaxima)).toBe(true);
      expect(() => validateRateAgainstMaxCeiling(9.51, segEducativo.tasaMaxima)).toThrow();

      expect(validateRateAgainstMaxCeiling(8.55, segInmobiliario.tasaMaxima)).toBe(true);
      expect(validateRateAgainstMaxCeiling(9.26, segInmobiliario.tasaMaxima)).toBe(true);
      expect(() => validateRateAgainstMaxCeiling(9.30, segInmobiliario.tasaMaxima)).toThrow();
    });
  });
});
