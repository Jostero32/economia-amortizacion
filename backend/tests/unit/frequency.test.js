/**
 * Pruebas Unitarias - Frecuencia de pago de créditos
 * La tasa del período sale de la TEA: i = (1 + TEA)^(días/360) - 1 (BCE, Anexo 1).
 */

const { calculateAmortization, nominalToEffectiveRate } = require('../../src/services/amortization');
const { effectiveToPeriodicRate } = require('../../src/services/amortization/frequencies');
const { selectApplicableCharges } = require('../../src/services/amortization/charges');
const { expectCloseToMoney } = require('../helpers/assertions');

const DESGRAVAMEN = {
  id: 2,
  nombre: 'Seguro de Desgravamen',
  categoria: 'SEGURO_DESGRAVAMEN',
  tipo: 'PORCENTAJE',
  porcentaje: 0.05,
  baseCalculo: 'SALDO_INSOLUTO',
  aplicacion: 'MENSUAL',
  obligatorio: false,
};

describe('Frecuencia de pago', () => {
  const trimestral = calculateAmortization({
    amount: 12000,
    termMonths: 24,
    annualRate: 22.05,
    paymentFrequency: 'TRIMESTRAL',
    startDate: '2026-10-31',
  });

  test('un crédito a 24 meses con pagos trimestrales tiene 8 cuotas cada 3 meses', () => {
    expect(trimestral.frecuenciaPago).toBe('TRIMESTRAL');
    expect(trimestral.numeroCuotas).toBe(8);
    expect(trimestral.rows.slice(0, 3).map((row) => row.fechaPago)).toEqual([
      '2027-01-31',
      '2027-04-30',
      '2027-07-31',
    ]);
    expectCloseToMoney(trimestral.totalCapital, 12000, 0.001);
    expect(trimestral.rows[7].saldoFinal).toBe(0);
  });

  test('usa la tasa del trimestre equivalente a la TEA y su tasa nominal de contrato', () => {
    expect(trimestral.tasaPeriodica).toBeCloseTo(effectiveToPeriodicRate(22.05, 90), 12);
    // La nominal trimestral reproduce la misma TEA con n = 90 días
    expect(nominalToEffectiveRate(trimestral.tasaNominal, 90)).toBeCloseTo(22.05, 6);
  });

  test('sin cargos, el costo efectivo anual coincide con la TEA en cualquier frecuencia', () => {
    ['MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL'].forEach((paymentFrequency) => {
      const res = calculateAmortization({ amount: 12000, termMonths: 24, annualRate: 22.05, paymentFrequency });
      expect(res.costoEfectivoAnual).toBeCloseTo(22.05, 1);
    });
  });

  test('con la misma TEA, pagar con menos frecuencia genera más intereses', () => {
    const mensual = calculateAmortization({ amount: 12000, termMonths: 24, annualRate: 22.05 });
    const semestral = calculateAmortization({ amount: 12000, termMonths: 24, annualRate: 22.05, paymentFrequency: 'SEMESTRAL' });
    expect(semestral.totalIntereses).toBeGreaterThan(mensual.totalIntereses);
  });

  test('la prima mensual de desgravamen se cobra por los meses del período', () => {
    const res = calculateAmortization({
      amount: 12000,
      termMonths: 24,
      annualRate: 22.05,
      paymentFrequency: 'TRIMESTRAL',
      charges: [DESGRAVAMEN],
    });
    // 12,000 × 0,05 % × 3 meses = 18,00 en la primera cuota trimestral
    expect(res.rows[0].cargos).toBe(18);
  });

  test('rechaza un plazo que no es múltiplo de la frecuencia', () => {
    expect(() => calculateAmortization({ amount: 1000, termMonths: 10, annualRate: 20, paymentFrequency: 'TRIMESTRAL' }))
      .toThrow('múltiplo de 3 meses');
  });
});

describe('Póliza de desgravamen propia', () => {
  test('en vivienda, con póliza propia endosada no se cobra la prima de la entidad', () => {
    const charges = selectApplicableCharges([DESGRAVAMEN], {
      requiresLifeInsurance: true,
      ownLifeInsurance: true,
    });
    expect(charges).toHaveLength(0);
  });
});
