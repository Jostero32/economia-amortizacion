/**
 * Pruebas Unitarias - Inversiones y Depósitos a Plazo Fijo (DPF)
 * Rendimiento financiero bajo la fórmula de interés simple comercial ecuatoriano (base 360 días).
 */

const {
  calculateInvestment,
  calculateProgrammedSavings,
  resolveInvestmentRate,
} = require('../../src/services/investment/calculator');
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
  // PAGO MENSUAL DE INTERESES
  // =========================================================================
  describe('Depósito con pago mensual de intereses', () => {
    const result = calculateInvestment({
      amount: 20000,
      annualRate: 5.09,
      termDays: 100,
      startDate: '2026-10-01',
      interestPayment: 'MENSUAL',
    });

    test('paga cada 30 días y el último período cubre los días restantes', () => {
      expect(result.pagoIntereses).toBe('MENSUAL');
      expect(result.cronogramaPagos.map((pago) => pago.dias)).toEqual([30, 30, 30, 10]);
      expect(result.cronogramaPagos.map((pago) => pago.fecha)).toEqual([
        '2026-10-31',
        '2026-11-30',
        '2026-12-30',
        '2027-01-09',
      ]);
    });

    test('el capital se devuelve con el último pago y los totales suman el cronograma', () => {
      const ultimo = result.cronogramaPagos[result.cronogramaPagos.length - 1];
      expect(ultimo.capital).toBe(20000);
      const sumaIntereses = result.cronogramaPagos.reduce((sum, pago) => sum + pago.interes, 0);
      expect(result.interesGanado).toBeCloseTo(sumaIntereses, 2);
      // Plazo menor a 180 días: se retiene el 3 % en cada pago
      expect(result.cronogramaPagos[0].retencion).toBe(Math.round(result.cronogramaPagos[0].interes * 3) / 100);
    });

    test('con pago mensual la TEA es mayor que la tasa nominal', () => {
      expect(result.tasaEfectiva).toBeGreaterThan(5.09);
    });
  });

  // =========================================================================
  // AHORRO PROGRAMADO (anualidad anticipada con capitalización mensual)
  // =========================================================================
  describe('Ahorro programado', () => {
    const plan = calculateProgrammedSavings({
      monthlyContribution: 100,
      termMonths: 12,
      annualRate: 6,
      startDate: '2026-10-31',
    });

    test('el saldo final coincide con el valor futuro de una anualidad anticipada', () => {
      const i = 0.06 / 12;
      const valorFuturo = 100 * ((Math.pow(1 + i, 12) - 1) / i) * (1 + i);
      // Los intereses se redondean mes a mes: diferencia máxima de centavos
      expect(Math.abs(plan.cronogramaPagos[11].saldo - valorFuturo)).toBeLessThan(0.05);
      expect(plan.capital).toBe(1200);
      expect(plan.interesGanado).toBeCloseTo(plan.cronogramaPagos[11].saldo - 1200, 2);
    });

    test('aportes mensuales el mismo día de cada mes y fin del plan un mes después del último aporte', () => {
      expect(plan.cronogramaPagos.slice(0, 3).map((pago) => pago.fecha)).toEqual(['2026-10-31', '2026-11-30', '2026-12-31']);
      expect(plan.fechaVencimiento).toBe('2027-10-31');
    });

    test('un plan de 12 meses está exento de retención y uno de 5 meses retiene el 3 %', () => {
      expect(plan.retencionIR).toBe(0);
      expect(plan.valorFinal).toBe(plan.cronogramaPagos[11].saldo);
      const corto = calculateProgrammedSavings({ monthlyContribution: 100, termMonths: 5, annualRate: 6 });
      expect(corto.tasaRetencion).toBe(3);
      expect(corto.retencionIR).toBeGreaterThan(0);
    });

    test('la TEA con capitalización mensual es mayor que la tasa nominal', () => {
      expect(plan.tasaEfectiva).toBeCloseTo((Math.pow(1.005, 12) - 1) * 100, 6);
    });
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
