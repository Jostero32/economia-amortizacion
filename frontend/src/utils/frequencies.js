// Frecuencias de pago de créditos (mismos códigos que el backend)
export const PAYMENT_FREQUENCIES = {
  MENSUAL: { codigo: 'MENSUAL', meses: 1, label: 'Mensual', cuota: 'mensual', plural: 'mensuales' },
  BIMESTRAL: { codigo: 'BIMESTRAL', meses: 2, label: 'Bimestral', cuota: 'bimestral', plural: 'bimestrales' },
  TRIMESTRAL: { codigo: 'TRIMESTRAL', meses: 3, label: 'Trimestral', cuota: 'trimestral', plural: 'trimestrales' },
  SEMESTRAL: { codigo: 'SEMESTRAL', meses: 6, label: 'Semestral', cuota: 'semestral', plural: 'semestrales' },
};

export const FREQUENCY_ORDER = ['MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL'];

export function getFrequency(code) {
  return PAYMENT_FREQUENCIES[code] || PAYMENT_FREQUENCIES.MENSUAL;
}
