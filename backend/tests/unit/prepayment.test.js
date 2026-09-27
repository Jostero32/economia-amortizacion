/**
 * Pruebas Unitarias - Abono extraordinario (pago anticipado sin penalidad)
 */

const { calculateAmortization } = require('../../src/services/amortization');
const { simulatePrepayment } = require('../../src/services/amortization/prepayment');
const { expectCloseToMoney } = require('../helpers/assertions');

function credit(system) {
  const result = calculateAmortization({
    amount: 10000,
    termMonths: 24,
    annualRate: 15.74,
    system,
    startDate: '2026-10-31',
  });
  const prepay = (afterInstallment, amount, option) => simulatePrepayment({
    rows: result.rows,
    system,
    principal: 10000,
    periodRate: result.tasaPeriodica,
    startDate: '2026-10-31',
    afterInstallment,
    amount,
    option,
  });
  return { result, prepay };
}

describe.each(['FRANCES', 'ALEMAN'])('Abono extraordinario - sistema %s', (system) => {
  const { result, prepay } = credit(system);

  test('el abono más el capital del nuevo cronograma suman el saldo que había', () => {
    ['REDUCIR_PLAZO', 'REDUCIR_CUOTA'].forEach((option) => {
      const res = prepay(6, 3000, option);
      const capital = res.nuevo.rows.reduce((sum, row) => sum + row.capital, 0);
      expectCloseToMoney(capital + res.abono, res.saldoAntes, 0.001);
      expect(res.nuevo.rows[res.nuevo.rows.length - 1].saldoFinal).toBe(0);
      expect(res.nuevo.rows[0].numeroCuota).toBe(7);
    });
  });

  test('reducir el plazo mantiene la cuota de capital e interés y elimina cuotas', () => {
    const res = prepay(6, 3000, 'REDUCIR_PLAZO');
    expect(res.nuevo.cuotas).toBeLessThan(res.original.cuotas);
    expect(res.cuotasMenos).toBeGreaterThan(0);
    if (system === 'FRANCES') {
      expect(res.nuevo.rows[0].cuota).toBeCloseTo(result.rows[6].cuota, 2);
    } else {
      expect(res.nuevo.rows[0].capital).toBe(result.rows[0].capital);
    }
  });

  test('reducir la cuota mantiene el número de cuotas y baja la cuota', () => {
    const res = prepay(6, 3000, 'REDUCIR_CUOTA');
    expect(res.nuevo.cuotas).toBe(res.original.cuotas);
    expect(res.nuevo.primeraCuota).toBeLessThan(res.original.primeraCuota);
  });

  test('reducir el plazo ahorra más intereses que reducir la cuota', () => {
    expect(prepay(6, 3000, 'REDUCIR_PLAZO').ahorroIntereses)
      .toBeGreaterThan(prepay(6, 3000, 'REDUCIR_CUOTA').ahorroIntereses);
  });

  test('abonar todo el saldo precancela el crédito y ahorra todos los intereses restantes', () => {
    const saldo = result.rows[11].saldoFinal;
    const res = prepay(12, saldo, 'REDUCIR_PLAZO');
    expect(res.nuevo.cuotas).toBe(0);
    expect(res.ahorroIntereses).toBe(res.original.interesesRestantes);
  });

  test('rechaza abonos mayores al saldo o cuotas fuera de rango', () => {
    expect(() => prepay(6, 1000000, 'REDUCIR_PLAZO')).toThrow('no puede superar el saldo');
    expect(() => prepay(24, 100, 'REDUCIR_PLAZO')).toThrow('Elige una cuota');
    expect(() => prepay(6, 100, 'OTRA')).toThrow('reduce el plazo o la cuota');
  });
});
