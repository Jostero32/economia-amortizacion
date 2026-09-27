/**
 * Cargos asociados a un crédito.
 *
 * Por ley, el costo del crédito es la tasa de interés efectiva más los impuestos de ley, y
 * está prohibido cobrar comisiones por la concesión del crédito o por prepago (Ley de
 * regulación del costo máximo efectivo del crédito). Por eso los cargos se limitan a:
 *
 * - IMPUESTO: contribución SOLCA del 0,5 %, retenida al desembolso. Si el plazo es menor a
 *   un año se calcula de forma anualizada (monto × 0,5 % × días / 360); si es de un año o
 *   más se cobra una sola vez sobre el monto.
 * - SEGURO_DESGRAVAMEN: prima mensual sobre el saldo de capital. Es obligatorio en créditos
 *   de vivienda; en el resto requiere la aceptación del cliente.
 * - SEGURO: otros seguros (incendio, vehículo).
 * - GASTO_TERCEROS: pagos a terceros (avalúo, notaría, registro).
 *
 * Momento de cobro según `aplicacion`:
 * - UNA_VEZ: al desembolso, se descuenta del monto que recibe el cliente.
 * - POR_CUOTA / MENSUAL: en cada cuota.
 */

const { roundToTwo } = require('../../utils/money');

const CHARGE_CATEGORIES = ['IMPUESTO', 'SEGURO_DESGRAVAMEN', 'SEGURO', 'GASTO_TERCEROS'];

// Segmentos de vivienda: el seguro de desgravamen es obligatorio (Superintendencia de Bancos)
const SEGMENTS_REQUIRING_LIFE_INSURANCE = ['INMOBILIARIO', 'VIVIENDA_VIS', 'VIVIENDA_VIP'];

function segmentRequiresLifeInsurance(segmentCode) {
  return SEGMENTS_REQUIRING_LIFE_INSURANCE.includes(segmentCode);
}

function isDisbursementCharge(charge) {
  return charge.aplicacion === 'UNA_VEZ';
}

function isPeriodicCharge(charge) {
  return charge.aplicacion === 'POR_CUOTA' || charge.aplicacion === 'MENSUAL';
}

/**
 * ¿El cliente puede decidir si contrata este cargo?
 */
function isOptionalCharge(charge, { requiresLifeInsurance = false } = {}) {
  if (charge.obligatorio) return false;
  if (charge.categoria === 'SEGURO_DESGRAVAMEN' && requiresLifeInsurance) return false;
  return true;
}

/**
 * Filtra los cargos que se aplican a la operación.
 * @param {Array} charges - Cargos activos del producto y generales
 * @param {Object} options
 * @param {Array<number>|undefined} options.acceptedOptionalIds - Cargos opcionales aceptados por el
 *   cliente. Si no se indica, se asumen todos aceptados (como la casilla marcada por defecto).
 * @param {boolean} options.requiresLifeInsurance - El producto exige seguro de desgravamen
 */
function selectApplicableCharges(charges, { acceptedOptionalIds, requiresLifeInsurance = false } = {}) {
  return charges.filter((charge) => {
    if (!isOptionalCharge(charge, { requiresLifeInsurance })) return true;
    if (acceptedOptionalIds === undefined || acceptedOptionalIds === null) return true;
    return acceptedOptionalIds.map(Number).includes(Number(charge.id));
  });
}

function summarizeCharge(charge, momento, valor) {
  return {
    id: charge.id,
    nombre: charge.nombre,
    categoria: charge.categoria || null,
    tipo: charge.tipo,
    aplicacion: charge.aplicacion,
    baseCalculo: charge.baseCalculo,
    porcentaje: charge.porcentaje !== undefined ? Number(charge.porcentaje) : null,
    momento,
    valor,
  };
}

/**
 * Cargos cobrados al desembolso (se descuentan del monto entregado al cliente)
 * @returns {Array} Resumen por cargo con su valor
 */
function calculateDisbursementCharges(charges, { principal, termMonths }) {
  return charges.filter(isDisbursementCharge).map((charge) => {
    let valor;
    if (charge.tipo === 'PORCENTAJE') {
      const porcentaje = Number(charge.porcentaje || 0) / 100;
      // Plazo menor a un año: contribución anualizada sobre los días del crédito (base 360)
      const factorPlazo = charge.anualizarSiPlazoMenorAnio && termMonths < 12 ? (termMonths * 30) / 360 : 1;
      valor = roundToTwo(principal * porcentaje * factorPlazo);
    } else {
      valor = roundToTwo(Number(charge.valor || 0));
    }
    return summarizeCharge(charge, 'DESEMBOLSO', valor);
  });
}

/**
 * Valor de un cargo periódico en una cuota
 * @param {Object} charge
 * @param {Object} context - { principal, saldoInicial, cuota }
 */
function calculatePeriodicChargeValue(charge, { principal, saldoInicial, cuota }) {
  if (charge.tipo !== 'PORCENTAJE') {
    return roundToTwo(Number(charge.valor || 0));
  }

  const porcentaje = Number(charge.porcentaje || 0) / 100;
  let base;
  if (charge.baseCalculo === 'SALDO_INSOLUTO') {
    base = saldoInicial;
  } else if (charge.baseCalculo === 'CUOTA') {
    base = cuota;
  } else {
    base = principal;
  }
  return roundToTwo(base * porcentaje);
}

/**
 * Crea un acumulador de cargos periódicos para una tabla de amortización
 */
function createPeriodicChargesAccumulator(charges) {
  const periodicCharges = charges.filter(isPeriodicCharge);
  const totals = new Map(periodicCharges.map((charge) => [charge, 0]));

  return {
    /**
     * Total de cargos de una cuota; acumula el valor por concepto
     */
    forInstallment(context) {
      let total = 0;
      periodicCharges.forEach((charge) => {
        const value = calculatePeriodicChargeValue(charge, context);
        totals.set(charge, roundToTwo(totals.get(charge) + value));
        total += value;
      });
      return roundToTwo(total);
    },
    summary() {
      return periodicCharges.map((charge) => summarizeCharge(charge, 'CUOTA', totals.get(charge)));
    },
  };
}

module.exports = {
  CHARGE_CATEGORIES,
  SEGMENTS_REQUIRING_LIFE_INSURANCE,
  segmentRequiresLifeInsurance,
  isDisbursementCharge,
  isPeriodicCharge,
  isOptionalCharge,
  selectApplicableCharges,
  calculateDisbursementCharges,
  calculatePeriodicChargeValue,
  createPeriodicChargesAccumulator,
};
