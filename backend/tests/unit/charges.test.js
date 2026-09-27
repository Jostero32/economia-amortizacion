/**
 * Pruebas Unitarias - Cargos asociados al crédito (práctica bancaria ecuatoriana)
 *
 * - Contribución SOLCA 0,5 %: impuesto de ley retenido al desembolso; anualizada si el plazo es
 *   menor a un año.
 * - Seguro de desgravamen: prima mensual sobre el saldo de capital; obligatorio en vivienda.
 * - Cargos fijos por cuota y gastos a terceros al desembolso.
 */

const { calculateAmortization } = require('../../src/services/amortization');
const { calculateGermanAmortization } = require('../../src/services/amortization/german');
const {
  selectApplicableCharges,
  segmentRequiresLifeInsurance,
} = require('../../src/services/amortization/charges');
const { expectCloseToMoney } = require('../helpers/assertions');

// TEA equivalente a una tasa mensual exacta del 1 %
const TEA_1_PCT_MENSUAL = (Math.pow(1.01, 12) - 1) * 100;

const SOLCA = {
  id: 1,
  nombre: 'Contribución SOLCA',
  categoria: 'IMPUESTO',
  tipo: 'PORCENTAJE',
  porcentaje: 0.5,
  baseCalculo: 'MONTO_OPERACION',
  aplicacion: 'UNA_VEZ',
  anualizarSiPlazoMenorAnio: true,
  obligatorio: true,
};

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

function simulate(termMonths, charges, extra = {}) {
  return calculateAmortization({
    amount: 10000,
    termMonths,
    annualRate: TEA_1_PCT_MENSUAL,
    system: 'FRANCES',
    startDate: '2026-10-01',
    charges,
    ...extra,
  });
}

describe('Contribución SOLCA (0,5 % retenido al desembolso)', () => {
  test('a 24 meses se retienen 50 USD y el cliente recibe 9,950 USD', () => {
    const res = simulate(24, [SOLCA]);

    expect(res.cargosDesembolso).toBe(50.0);
    expect(res.montoLiquido).toBe(9950.0);
    // No se suma a las cuotas ni se confunde con el interés
    res.rows.forEach((row) => expect(row.cargos).toBe(0));
    expect(res.totalPagar).toBe(Math.round((res.totalCapital + res.totalIntereses) * 100) / 100);
    expect(res.totalCargos).toBe(50.0);
  });

  test('con plazo de un año exacto se cobra una sola vez sobre el monto (50 USD)', () => {
    expect(simulate(12, [SOLCA]).cargosDesembolso).toBe(50.0);
  });

  test('con plazo menor a un año se anualiza: 6 meses = 10,000 × 0,5 % × 180/360 = 25 USD', () => {
    expect(simulate(6, [SOLCA]).cargosDesembolso).toBe(25.0);
  });

  test('el desglose informa el momento de cobro y el valor real', () => {
    const [solca] = simulate(24, [SOLCA]).desgloseCargos;
    expect(solca).toMatchObject({ nombre: 'Contribución SOLCA', momento: 'DESEMBOLSO', valor: 50 });
  });
});

describe('Seguro de desgravamen (prima mensual sobre el saldo de capital)', () => {
  test('cada cuota cobra el 0,05 % del saldo inicial y el desglose suma lo cobrado', () => {
    const res = simulate(12, [DESGRAVAMEN]);

    res.rows.forEach((row) => {
      expect(row.cargos).toBe(Math.round(row.saldoInicial * 0.0005 * 100) / 100);
      expectCloseToMoney(row.totalPago, row.cuota + row.cargos, 0.001);
    });

    const cobrado = res.rows.reduce((sum, row) => sum + row.cargos, 0);
    const [desgravamen] = res.desgloseCargos;
    expect(desgravamen.momento).toBe('CUOTA');
    expectCloseToMoney(desgravamen.valor, cobrado, 0.001);
    expectCloseToMoney(res.totalCargos, cobrado, 0.001);
    // La prima baja a medida que se amortiza el capital
    expect(res.rows[0].cargos).toBeGreaterThan(res.rows[11].cargos);
  });

  test('el cliente puede no aceptar el desgravamen en un crédito de consumo', () => {
    const charges = selectApplicableCharges([SOLCA, DESGRAVAMEN], {
      acceptedOptionalIds: [],
      requiresLifeInsurance: segmentRequiresLifeInsurance('CONSUMO'),
    });
    expect(charges.map((c) => c.nombre)).toEqual(['Contribución SOLCA']);
  });

  test('en créditos de vivienda el desgravamen es obligatorio aunque el cliente no lo marque', () => {
    ['INMOBILIARIO', 'VIVIENDA_VIS', 'VIVIENDA_VIP'].forEach((segmento) => {
      const charges = selectApplicableCharges([SOLCA, DESGRAVAMEN], {
        acceptedOptionalIds: [],
        requiresLifeInsurance: segmentRequiresLifeInsurance(segmento),
      });
      expect(charges).toHaveLength(2);
    });
  });

  test('si no se indica qué cargos opcionales acepta, se incluyen todos', () => {
    expect(selectApplicableCharges([SOLCA, DESGRAVAMEN], {})).toHaveLength(2);
  });
});

describe('Otros cargos', () => {
  test('un seguro fijo de 5 USD por cuota suma 60 USD en 12 cuotas', () => {
    const res = simulate(12, [{
      id: 3,
      nombre: 'Seguro vehicular',
      categoria: 'SEGURO',
      tipo: 'VALOR_FIJO',
      valor: 5.0,
      aplicacion: 'POR_CUOTA',
      obligatorio: true,
    }]);

    expect(res.totalCargos).toBe(60.0);
    res.rows.forEach((row) => {
      expect(row.cargos).toBe(5.0);
      expect(row.totalPago).toBe(Math.round((row.cuota + 5) * 100) / 100);
    });
  });

  test('un gasto a terceros de pago único (avalúo 50 USD) se descuenta al desembolso', () => {
    const res = simulate(12, [{
      id: 4,
      nombre: 'Avalúo del inmueble',
      categoria: 'GASTO_TERCEROS',
      tipo: 'VALOR_FIJO',
      valor: 50.0,
      aplicacion: 'UNA_VEZ',
      obligatorio: true,
    }]);

    expect(res.cargosDesembolso).toBe(50.0);
    expect(res.montoLiquido).toBe(9950.0);
    expect(res.rows[0].cargos).toBe(0);
  });

  test('los cargos por cuota no alteran la amortización constante del sistema alemán', () => {
    const res = calculateGermanAmortization({
      principal: 12000,
      monthlyRate: 0.01,
      termMonths: 12,
      charges: [{ id: 5, nombre: 'Seguro', tipo: 'VALOR_FIJO', valor: 10.0, aplicacion: 'POR_CUOTA' }],
    });

    expect(res.totalCargos).toBe(120.0);
    res.rows.forEach((row) => {
      expect(row.capital).toBe(1000.0);
      expect(row.cargos).toBe(10.0);
    });
  });
});

describe('Tasas informadas al cliente', () => {
  test('sin cargos, el costo efectivo anual coincide con la TEA', () => {
    const res = calculateAmortization({ amount: 10000, termMonths: 24, annualRate: 16.77, startDate: '2026-10-01' });
    expect(res.tasaNominal).toBeCloseTo(15.6042, 3);
    expect(res.costoEfectivoAnual).toBeCloseTo(16.77, 1);
  });

  test('con SOLCA y desgravamen el costo efectivo anual supera la TEA legal', () => {
    const res = calculateAmortization({
      amount: 10000,
      termMonths: 24,
      annualRate: 16.77,
      startDate: '2026-10-01',
      charges: [SOLCA, DESGRAVAMEN],
    });
    expect(res.tasaAnual).toBe(16.77);
    expect(res.costoEfectivoAnual).toBeGreaterThan(17.5);
    expect(res.costoEfectivoAnual).toBeLessThan(18.5);
  });
});
