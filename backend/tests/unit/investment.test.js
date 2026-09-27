/**
 * Pruebas Unitarias - Inversiones y Depósitos a Plazo Fijo (DPF)
 * Rendimiento financiero bajo la fórmula de interés simple comercial ecuatoriano (base 360 días).
 */

const { calculateInvestment, resolveInvestmentRate } = require('../../src/services/investment/calculator');
const INVESTMENT_CASES = require('../fixtures/investmentCases');
const BCE_RATES_SEPT_2026 = require('../fixtures/bceRates.sept2026');

describe('Cálculos de Rendimiento de Inversiones y Depósitos a Plazo Fijo (DPF)', () => {
  // =========================================================================
  // CASO 1 (SECCIÓN 23): 10,000 USD al 5% anual por 360 días
  // =========================================================================
  test('Caso 1: 10,000 USD al 5.00% anual a 360 días genera exactamente 500 USD de interés y 10,500 USD final', () => {
    const { capital, tasaAnual, dias, esperado } = INVESTMENT_CASES.CASE_10K_5PCT_360D;
    const result = calculateInvestment({
      amount: capital,
      annualRate: tasaAnual,
      termDays: dias,
    });

    expect(result.capital).toBe(capital);
    expect(result.tasaAnual).toBe(tasaAnual);
    expect(result.plazoDias).toBe(dias);
    expect(result.interesGanado).toBe(esperado.interesGanado);
    expect(result.valorFinal).toBe(esperado.valorFinal);
  });

  // =========================================================================
  // CASO 2 (SECCIÓN 23): 5,000 USD al 6% anual por 180 días
  // =========================================================================
  test('Caso 2: 5,000 USD al 6.00% anual a 180 días genera exactamente 150 USD de interés y 5,150 USD final', () => {
    const { capital, tasaAnual, dias, esperado } = INVESTMENT_CASES.CASE_5K_6PCT_180D;
    const result = calculateInvestment({
      amount: capital,
      annualRate: tasaAnual,
      termDays: dias,
    });

    expect(result.interesGanado).toBe(esperado.interesGanado);
    expect(result.valorFinal).toBe(esperado.valorFinal);
  });

  // =========================================================================
  // CASO 3: 20,000 USD al 7.5% anual por 90 días
  // =========================================================================
  test('Caso 3: 20,000 USD al 7.50% anual a 90 días genera 375 USD de interés, retiene 11.25 USD y entrega 20,363.75 USD', () => {
    const { capital, tasaAnual, dias, esperado } = INVESTMENT_CASES.CASE_20K_75PCT_90D;
    const result = calculateInvestment({
      amount: capital,
      annualRate: tasaAnual,
      termDays: dias,
    });

    expect(result.interesGanado).toBe(esperado.interesGanado);
    expect(result.retencionIR).toBe(esperado.retencionIR);
    expect(result.interesNeto).toBe(esperado.interesNeto);
    expect(result.valorFinal).toBe(esperado.valorFinal);
  });

  // =========================================================================
  // RETENCIÓN DEL IMPUESTO A LA RENTA (3 %, exenta desde 180 días)
  // =========================================================================
  describe('Retención en la fuente sobre los intereses', () => {
    test('a 179 días se retiene el 3 % del interés', () => {
      const result = calculateInvestment({ amount: 10000, annualRate: 6, termDays: 179 });
      // 10,000 * 0.06 * 179 / 360 = 298.33; retención 3 % = 8.95
      expect(result.exentoRetencion).toBe(false);
      expect(result.tasaRetencion).toBe(3);
      expect(result.interesGanado).toBe(298.33);
      expect(result.retencionIR).toBe(8.95);
      expect(result.valorFinal).toBe(10289.38);
    });

    test('desde 180 días el interés está exento y no se retiene', () => {
      const result = calculateInvestment({ amount: 10000, annualRate: 6, termDays: 180 });
      expect(result.exentoRetencion).toBe(true);
      expect(result.retencionIR).toBe(0);
      expect(result.interesNeto).toBe(result.interesGanado);
    });
  });

  // =========================================================================
  // FECHAS Y TASA EFECTIVA
  // =========================================================================
  test('la fecha de vencimiento suma días calendario a la fecha de apertura', () => {
    const result = calculateInvestment({ amount: 1000, annualRate: 5, termDays: 360, startDate: '2026-09-26' });
    expect(result.fechaInicio).toBe('2026-09-26');
    expect(result.fechaVencimiento).toBe('2027-09-21');
  });

  test('la TEA de un depósito a 360 días es igual a su tasa nominal', () => {
    const result = calculateInvestment({ amount: 1000, annualRate: 5.09, termDays: 360 });
    expect(result.tasaEfectiva).toBeCloseTo(5.09, 6);
  });

  // =========================================================================
  // TASA POR TRAMO DE PLAZO
  // =========================================================================
  describe('Selección de la tasa según el tramo de días', () => {
    const product = {
      tasa: 5.09,
      rates: [
        { plazoMinDias: 30, plazoMaxDias: 60, tasa: '4.0300', activo: true },
        { plazoMinDias: 61, plazoMaxDias: 90, tasa: '4.4000', activo: true },
        { plazoMinDias: 91, plazoMaxDias: 180, tasa: '4.4600', activo: false },
      ],
    };

    test('usa la tasa del tramo que contiene el plazo', () => {
      expect(resolveInvestmentRate(product, 60)).toBe(4.03);
      expect(resolveInvestmentRate(product, 61)).toBe(4.4);
    });

    test('ignora tramos inactivos y usa la tasa base si ningún tramo aplica', () => {
      expect(resolveInvestmentRate(product, 120)).toBe(5.09);
    });
  });

  // =========================================================================
  // CASO PASIVO REFERENCIAL BCE: 4.99% (Septiembre 2026)
  // =========================================================================
  test('Aplica correctamente la tasa pasiva referencial oficial del BCE (4.99% para Septiembre 2026)', () => {
    const capital = 10000;
    const dias = 360;
    const tasaBCE = BCE_RATES_SEPT_2026.tasaPasivaReferencial; // 4.99%

    const result = calculateInvestment({
      amount: capital,
      annualRate: tasaBCE,
      termDays: dias,
    });

    // 10,000 * 0.0499 * 360 / 360 = 499.00 USD
    expect(result.interesGanado).toBe(499.00);
    expect(result.valorFinal).toBe(10499.00);
  });

  // =========================================================================
  // CONTROL DE ERRORES Y VALIDACIONES DE ENTRADA
  // =========================================================================
  describe('Validaciones de Entrada en Simulador de Inversiones', () => {
    test('lanza error si el monto de inversión es menor o igual a cero', () => {
      expect(() => {
        calculateInvestment({ amount: 0, annualRate: 5, termDays: 180 });
      }).toThrow('El monto de inversión debe ser mayor a 0.');

      expect(() => {
        calculateInvestment({ amount: -1000, annualRate: 5, termDays: 180 });
      }).toThrow('El monto de inversión debe ser mayor a 0.');
    });

    test('lanza error si el plazo en días es menor o igual a cero', () => {
      expect(() => {
        calculateInvestment({ amount: 1000, annualRate: 5, termDays: 0 });
      }).toThrow('El plazo en días debe ser un entero positivo mayor a 0.');

      expect(() => {
        calculateInvestment({ amount: 1000, annualRate: 5, termDays: -30 });
      }).toThrow('El plazo en días debe ser un entero positivo mayor a 0.');
    });

    test('lanza error si la tasa de interés anual es negativa', () => {
      expect(() => {
        calculateInvestment({ amount: 1000, annualRate: -2, termDays: 180 });
      }).toThrow('La tasa de interés debe ser un valor no negativo.');
    });
  });
});
