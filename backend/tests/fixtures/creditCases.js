/**
 * Fixtures de Casos de Amortización para Pruebas Independientes
 * Valores calculados de forma externa e independiente (sin reusar fórmulas de producción)
 */

const CREDIT_CASES = {
  // CASO FRANCÉS 1: 10,000 USD al 12% nominal anual (1% periódico mensual), 12 meses, sin cargos
  FRENCH_10K_12PCT_12M: {
    monto: 10000,
    tasaMensual: 0.01,
    plazoMeses: 12,
    sistema: 'FRANCES',
    esperado: {
      cantidadCuotas: 12,
      cuotaMensualAprox: 888.49,
      saldoInicial: 10000.00,
      primerInteres: 100.00,
      primerCapital: 788.49,
      saldoDespuesCuota1: 9211.51,
      totalCapital: 10000.00,
      totalInteresAprox: 661.85,
      totalPagarAprox: 10661.85,
      saldoFinal: 0.00,
    },
  },

  // CASO FRANCÉS 2 (TASA CERO / EDGE CASE): 1,000 USD al 0% mensual, 10 meses
  FRENCH_1K_0PCT_10M: {
    monto: 1000,
    tasaMensual: 0.0,
    plazoMeses: 10,
    sistema: 'FRANCES',
    esperado: {
      cantidadCuotas: 10,
      cuotaMensual: 100.00,
      totalCapital: 1000.00,
      totalInteres: 0.00,
      totalPagar: 1000.00,
      saldoFinal: 0.00,
    },
  },

  // CASO FRANCÉS 3 (TABLA INDEPENDIENTE DETALLADA): 5,000 USD al 1% mensual, 6 meses
  FRENCH_5K_1PCT_6M: {
    monto: 5000,
    tasaMensual: 0.01,
    plazoMeses: 6,
    sistema: 'FRANCES',
    esperado: {
      cuotaMensualTeorica: 862.74,
      totalCapital: 5000.00,
      totalInteres: 176.44,
      totalPagar: 5176.44,
      saldoFinal: 0.00,
      filas: [
        { cuota: 1, saldoInicial: 5000.00, interes: 50.00, capital: 812.74, cuotaTotal: 862.74, saldoFinal: 4187.26 },
        { cuota: 2, saldoInicial: 4187.26, interes: 41.87, capital: 820.87, cuotaTotal: 862.74, saldoFinal: 3366.39 },
        { cuota: 3, saldoInicial: 3366.39, interes: 33.66, capital: 829.08, cuotaTotal: 862.74, saldoFinal: 2537.31 },
        { cuota: 4, saldoInicial: 2537.31, interes: 25.37, capital: 837.37, cuotaTotal: 862.74, saldoFinal: 1699.94 },
        { cuota: 5, saldoInicial: 1699.94, interes: 17.00, capital: 845.74, cuotaTotal: 862.74, saldoFinal: 854.20 },
        { cuota: 6, saldoInicial: 854.20, interes: 8.54, capital: 854.20, cuotaTotal: 862.74, saldoFinal: 0.00 },
      ],
    },
  },

  // CASO ALEMÁN: 12,000 USD al 1% mensual, 12 meses (Amortización constante 1,000/mes)
  GERMAN_12K_1PCT_12M: {
    monto: 12000,
    tasaMensual: 0.01,
    plazoMeses: 12,
    sistema: 'ALEMAN',
    esperado: {
      amortizacionConstante: 1000.00,
      primeraCuota: 1120.00,
      segundaCuota: 1110.00,
      terceraCuota: 1100.00,
      ultimaCuota: 1010.00,
      totalCapital: 12000.00,
      totalInteres: 780.00,
      totalPagar: 12780.00,
      saldoFinal: 0.00,
    },
  },

  // CASO REGULATORIO REAL BCE: Crédito de Consumo 10,000 USD al 15.74% TEA, 12 meses
  CONSUMO_ECUADOR_10K_1574TEA_12M: {
    monto: 10000,
    tasaAnualEfectiva: 15.74,
    // (1 + 0.1574)^(30/360) - 1 = 0.0122444...
    tasaMensualEquivalente: 0.012244406,
    plazoMeses: 12,
    sistema: 'FRANCES',
    esperado: {
      totalCapital: 10000.00,
      saldoFinal: 0.00,
    },
  },
};

module.exports = CREDIT_CASES;
