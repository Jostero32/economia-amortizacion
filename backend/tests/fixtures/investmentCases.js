/**
 * Fixtures de Casos de Depósito a Plazo Fijo (DPF) / Inversiones
 * Base comercial ecuatoriana (360 días): Interés = Capital * (Tasa / 100) * (Días / 360)
 */

const INVESTMENT_CASES = {
  // CASO 1: 10,000 USD al 5% anual, 360 días
  // 10,000 * 0.05 * 360 / 360 = 500 USD
  CASE_10K_5PCT_360D: {
    capital: 10000,
    tasaAnual: 5.00,
    dias: 360,
    esperado: {
      interesGanado: 500.00,
      valorFinal: 10500.00,
    },
  },

  // CASO 2: 5,000 USD al 6% anual, 180 días
  // 5,000 * 0.06 * 180 / 360 = 150 USD
  CASE_5K_6PCT_180D: {
    capital: 5000,
    tasaAnual: 6.00,
    dias: 180,
    esperado: {
      interesGanado: 150.00,
      valorFinal: 5150.00,
    },
  },

  // CASO 3: 20,000 USD al 7.5% anual, 90 días
  // 20,000 * 0.075 * 90 / 360 = 375 USD
  CASE_20K_75PCT_90D: {
    capital: 20000,
    tasaAnual: 7.50,
    dias: 90,
    esperado: {
      interesGanado: 375.00,
      valorFinal: 20375.00,
    },
  },
};

module.exports = INVESTMENT_CASES;
