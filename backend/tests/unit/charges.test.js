/**
 * Pruebas Unitarias - Cargos Financieros Adicionales y Regulación Ecuatoriana (SOLCA)
 * Verifica cargos porcentuales, fijos, de cobro único, mensuales y la Contribución del 0.50% a SOLCA.
 */

const { calculateFrenchAmortization } = require('../../src/services/amortization/french');
const { calculateGermanAmortization } = require('../../src/services/amortization/german');
const { expectCloseToMoney } = require('../helpers/assertions');

describe('Cargos Adicionales y Cobros Regulatorios en Amortización', () => {
  const principal = 10000;
  const monthlyRate = 0.01;
  const termMonths = 12;

  // =========================================================================
  // CARGO PORCENTUAL ÚNICO: 1% DE APERTURA (100 USD en cuota 1)
  // =========================================================================
  test('cargo porcentual de cobro único (1% de apertura = 100 USD)', () => {
    const chargeApertura = {
      id: 'cargo-1',
      nombre: 'Comisión de Apertura',
      tipo: 'PORCENTAJE',
      porcentaje: 1.0,
      aplicacion: 'UNA_VEZ',
    };

    const res = calculateFrenchAmortization({
      principal,
      monthlyRate,
      termMonths,
      charges: [chargeApertura],
    });

    expect(res.totalCargos).toBe(100.00);
    // En la cuota 1 se suma el cargo
    expect(res.rows[0].cargos).toBe(100.00);
    expect(res.rows[0].totalPago).toBe(res.rows[0].cuota + 100.00);

    // En las cuotas 2 a 12 los cargos son 0.00
    for (let k = 1; k < termMonths; k++) {
      expect(res.rows[k].cargos).toBe(0.00);
      expect(res.rows[k].totalPago).toBe(res.rows[k].cuota);
    }
  });

  // =========================================================================
  // CARGO FIJO ÚNICO: 50 USD
  // =========================================================================
  test('cargo fijo de cobro único (50.00 USD en primera cuota)', () => {
    const chargeFijo = {
      id: 'cargo-2',
      nombre: 'Gastos Administrativos Iniciales',
      tipo: 'VALOR_FIJO',
      valor: 50.00,
      aplicacion: 'UNA_VEZ',
    };

    const res = calculateFrenchAmortization({
      principal,
      monthlyRate,
      termMonths,
      charges: [chargeFijo],
    });

    expect(res.totalCargos).toBe(50.00);
    expect(res.rows[0].cargos).toBe(50.00);
    expect(res.rows[1].cargos).toBe(0.00);
  });

  // =========================================================================
  // CONTRIBUCIÓN OBLIGATORIA A SOLCA (LEY ECUATORIANA: 0.50% SOBRE EL CAPITAL)
  // Código Orgánico Monetario y Financiero - Art. Contribución 0.50% a SOLCA
  // =========================================================================
  test('la Contribución a SOLCA (0.50% = 50 USD sobre 10,000 USD) se cobra de forma independiente y no se capitaliza ni confunde con el interés', () => {
    const chargeSOLCA = {
      id: 'solca-mandatory',
      nombre: 'Contribución Especial SOLCA (0.50%)',
      tipo: 'PORCENTAJE',
      porcentaje: 0.50,
      aplicacion: 'UNA_VEZ',
      esObligatorio: true,
    };

    const res = calculateFrenchAmortization({
      principal,
      monthlyRate,
      termMonths,
      charges: [chargeSOLCA],
    });

    // 10,000 * 0.005 = 50.00 USD exactos
    expect(res.totalCargos).toBe(50.00);
    // El interés acumulado no se ve alterado por la contribución de SOLCA
    expectCloseToMoney(res.totalCapital, 10000.00, 0.01);
    expectCloseToMoney(res.totalIntereses, 661.85, 0.50);
    // Total a pagar incluye capital + intereses + SOLCA
    expect(res.totalPagar).toBe(res.totalCapital + res.totalIntereses + 50.00);
  });

  // =========================================================================
  // CARGO MENSUAL FIJO RECURRENTE: SEGURO DE DESGRAVAMEN FIJO (5.00 USD/mes)
  // =========================================================================
  test('cargo mensual recurrente (5.00 USD en cada cuota = 60.00 USD en total)', () => {
    const chargeSeguro = {
      id: 'seguro-fijo',
      nombre: 'Seguro de Desgravamen Fijo',
      tipo: 'VALOR_FIJO',
      valor: 5.00,
      aplicacion: 'POR_CUOTA',
    };

    const res = calculateFrenchAmortization({
      principal,
      monthlyRate,
      termMonths,
      charges: [chargeSeguro],
    });

    expect(res.totalCargos).toBe(60.00);
    res.rows.forEach(row => {
      expect(row.cargos).toBe(5.00);
      expect(row.totalPago).toBe(row.cuota + 5.00);
    });
  });

  // =========================================================================
  // COMPATIBILIDAD CON SISTEMA ALEMÁN
  // =========================================================================
  test('los cargos se aplican correctamente en el Sistema Alemán sin afectar la amortización constante', () => {
    const chargeFijo = {
      id: 'cargo-aleman',
      nombre: 'Mantenimiento de Cuenta',
      tipo: 'VALOR_FIJO',
      valor: 10.00,
      aplicacion: 'POR_CUOTA',
    };

    const res = calculateGermanAmortization({
      principal: 12000,
      monthlyRate: 0.01,
      termMonths: 12,
      charges: [chargeFijo],
    });

    expect(res.totalCargos).toBe(120.00);
    // Amortización constante intacta de 1,000 USD
    res.rows.forEach(row => {
      expect(row.capital).toBe(1000.00);
      expect(row.cargos).toBe(10.00);
    });
  });
});
