/**
 * Calculadora de Rendimiento para Depósitos a Plazo Fijo (Ecuador)
 *
 * Interés simple comercial (base 360 días), pago al vencimiento:
 * interesBruto = capital * (tasaNominal / 100) * (dias / 360)
 *
 * Retención en la fuente del Impuesto a la Renta sobre los intereses:
 * 3 % desde el 1-mar-2026 (Resolución SRI NAC-DGERCGC26-00000009). Exentos los
 * depósitos con plazo igual o superior a 180 días (LRTI, Art. 9, num. 15.1).
 *
 * valorFinal = capital + interesBruto - retencionIR
 */

const { roundToTwo } = require('../../utils/money');
const { addDays, addMonthsClamped, todayISO, toISODate } = require('../../utils/dates');

const TASA_RETENCION_IR = 3.0;
const PLAZO_EXENTO_RETENCION_DIAS = 180;

/**
 * Tasa aplicable a un plazo según los tramos vigentes del producto.
 * Si ningún tramo cubre el plazo se usa la tasa base del producto.
 *
 * @param {Object} product - Producto con `tasa` y `rates` [{ plazoMinDias, plazoMaxDias, tasa, activo }]
 * @param {number} termDays - Plazo en días
 * @returns {number} Tasa nominal anual en porcentaje
 */
function resolveInvestmentRate(product, termDays) {
  const dias = Number(termDays);
  const rates = (product.rates || []).filter((rate) => rate.activo !== false);
  const matchRate = rates.find(
    (rate) => dias >= Number(rate.plazoMinDias) && dias <= Number(rate.plazoMaxDias)
  );
  return Number(matchRate ? matchRate.tasa : product.tasa);
}

// Período de pago de intereses cuando el depósito paga mensualmente
const MONTHLY_PERIOD_DAYS = 30;

/**
 * Cronograma de pagos de intereses cada 30 días; el último período puede ser más corto.
 * La retención se aplica en cada pago si el plazo total no está exento.
 */
function buildMonthlySchedule({ capital, dias, tasa, fechaInicio, tasaRetencion }) {
  const pagos = [];
  let diasTranscurridos = 0;
  for (let numero = 1; diasTranscurridos < dias; numero++) {
    const diasPeriodo = Math.min(MONTHLY_PERIOD_DAYS, dias - diasTranscurridos);
    diasTranscurridos += diasPeriodo;
    const interes = roundToTwo(capital * (tasa / 100) * (diasPeriodo / 360));
    const retencion = roundToTwo(interes * (tasaRetencion / 100));
    const esUltimo = diasTranscurridos === dias;
    const interesNeto = roundToTwo(interes - retencion);
    pagos.push({
      numero,
      fecha: addDays(fechaInicio, diasTranscurridos),
      dias: diasPeriodo,
      interes,
      retencion,
      interesNeto,
      // El capital se devuelve junto con el último pago de intereses
      capital: esUltimo ? roundToTwo(capital) : 0,
      totalRecibido: roundToTwo(interesNeto + (esUltimo ? capital : 0)),
    });
  }
  return pagos;
}

/**
 * Calcula el rendimiento de una inversión a plazo fijo
 * @param {Object} params
 * @param {number} params.amount - Capital invertido en dólares
 * @param {number} params.termDays - Plazo en días
 * @param {number} params.annualRate - Tasa nominal anual en porcentaje (ej: 5.09)
 * @param {string} [params.startDate] - Fecha de apertura (YYYY-MM-DD), por defecto hoy en Ecuador
 * @param {'AL_VENCIMIENTO'|'MENSUAL'} [params.interestPayment='AL_VENCIMIENTO'] - Forma de pago de intereses
 * @returns {Object} Resumen del cálculo
 */
function calculateInvestment({ amount, termDays, annualRate, startDate, interestPayment = 'AL_VENCIMIENTO' }) {
  const capital = Number(amount);
  const dias = parseInt(termDays, 10);
  const tasa = Number(annualRate);

  if (isNaN(capital) || capital <= 0) {
    throw new Error('El monto de inversión debe ser mayor a 0.');
  }
  if (isNaN(dias) || dias <= 0) {
    throw new Error('El plazo en días debe ser un entero positivo mayor a 0.');
  }
  if (isNaN(tasa) || tasa < 0) {
    throw new Error('La tasa de interés debe ser un valor no negativo.');
  }

  const fechaInicio = startDate ? toISODate(startDate) : todayISO();
  const fechaVencimiento = addDays(fechaInicio, dias);

  const exentoRetencion = dias >= PLAZO_EXENTO_RETENCION_DIAS;
  const tasaRetencion = exentoRetencion ? 0 : TASA_RETENCION_IR;
  const pagoMensual = interestPayment === 'MENSUAL';

  let interesGanado;
  let retencionIR;
  let cronogramaPagos = null;
  if (pagoMensual) {
    // Intereses pagados cada 30 días: los totales son la suma de lo que se paga en cada período
    cronogramaPagos = buildMonthlySchedule({ capital, dias, tasa, fechaInicio, tasaRetencion });
    interesGanado = roundToTwo(cronogramaPagos.reduce((sum, pago) => sum + pago.interes, 0));
    retencionIR = roundToTwo(cronogramaPagos.reduce((sum, pago) => sum + pago.retencion, 0));
  } else {
    // Rendimiento financiero base 360 días, pagado al vencimiento
    interesGanado = roundToTwo(capital * (tasa / 100) * (dias / 360));
    retencionIR = roundToTwo(interesGanado * (tasaRetencion / 100));
  }
  const interesNeto = roundToTwo(interesGanado - retencionIR);
  const valorFinal = roundToTwo(capital + interesNeto);

  // TEA (BCE, Anexo 1): n = plazo con pago al vencimiento, 30 días con pago mensual
  const periodoDias = pagoMensual ? Math.min(MONTHLY_PERIOD_DAYS, dias) : dias;
  const tasaEfectiva = (Math.pow(1 + (tasa / 100) * (periodoDias / 360), 360 / periodoDias) - 1) * 100;

  return {
    capital: roundToTwo(capital),
    plazoDias: dias,
    tasaAnual: tasa,
    tasaEfectiva,
    pagoIntereses: pagoMensual ? 'MENSUAL' : 'AL_VENCIMIENTO',
    cronogramaPagos,
    interesGanado,
    exentoRetencion,
    tasaRetencion,
    retencionIR,
    interesNeto,
    valorFinal,
    fechaInicio,
    fechaVencimiento,
    nota: 'Simulación didáctica de carácter informativo. Los valores reales pueden variar según la política de la institución.',
  };
}

/**
 * Ahorro programado: aportes mensuales fijos al inicio de cada mes que capitalizan interés.
 *
 * Con i = tasa nominal anual / 12, el saldo de cada mes es (saldo anterior + aporte)·(1 + i), es
 * decir, el valor futuro de una anualidad anticipada: VF = A · [((1+i)^n - 1) / i] · (1+i).
 * Los intereses se calculan y redondean mes a mes. La retención del Impuesto a la Renta se aplica
 * con la misma regla del depósito a plazo (exento desde 180 días).
 *
 * @param {Object} params
 * @param {number} params.monthlyContribution - Aporte mensual
 * @param {number} params.termMonths - Número de meses de ahorro
 * @param {number} params.annualRate - Tasa nominal anual en porcentaje
 * @param {string} [params.startDate] - Fecha del primer aporte
 * @returns {Object} Resumen y cronograma de aportes
 */
function calculateProgrammedSavings({ monthlyContribution, termMonths, annualRate, startDate }) {
  const aporte = Number(monthlyContribution);
  const meses = parseInt(termMonths, 10);
  const tasa = Number(annualRate);

  if (isNaN(aporte) || aporte <= 0) {
    throw new Error('El aporte mensual debe ser mayor a 0.');
  }
  if (isNaN(meses) || meses <= 0) {
    throw new Error('El plazo en meses debe ser un entero positivo mayor a 0.');
  }
  if (isNaN(tasa) || tasa < 0) {
    throw new Error('La tasa de interés debe ser un valor no negativo.');
  }

  const fechaInicio = startDate ? toISODate(startDate) : todayISO();
  const tasaMensual = tasa / 100 / 12;

  const cronogramaPagos = [];
  let saldo = 0;
  let interesGanado = 0;
  for (let numero = 1; numero <= meses; numero++) {
    const saldoConAporte = roundToTwo(saldo + aporte);
    const interes = roundToTwo(saldoConAporte * tasaMensual);
    saldo = roundToTwo(saldoConAporte + interes);
    interesGanado = roundToTwo(interesGanado + interes);
    cronogramaPagos.push({
      numero,
      fecha: addMonthsClamped(fechaInicio, numero - 1),
      aporte: roundToTwo(aporte),
      interes,
      saldo,
    });
  }

  const dias = meses * 30;
  const exentoRetencion = dias >= PLAZO_EXENTO_RETENCION_DIAS;
  const tasaRetencion = exentoRetencion ? 0 : TASA_RETENCION_IR;
  const retencionIR = roundToTwo(interesGanado * (tasaRetencion / 100));
  const interesNeto = roundToTwo(interesGanado - retencionIR);
  const totalAportado = roundToTwo(aporte * meses);

  return {
    aporteMensual: roundToTwo(aporte),
    capital: totalAportado,
    plazoDias: dias,
    plazoMeses: meses,
    tasaAnual: tasa,
    // Capitalización mensual: TEA = (1 + i/12)^12 - 1
    tasaEfectiva: (Math.pow(1 + tasaMensual, 12) - 1) * 100,
    pagoIntereses: 'AL_VENCIMIENTO',
    cronogramaPagos,
    interesGanado,
    exentoRetencion,
    tasaRetencion,
    retencionIR,
    interesNeto,
    valorFinal: roundToTwo(totalAportado + interesNeto),
    fechaInicio,
    fechaVencimiento: addMonthsClamped(fechaInicio, meses),
  };
}

module.exports = {
  TASA_RETENCION_IR,
  PLAZO_EXENTO_RETENCION_DIAS,
  calculateProgrammedSavings,
  calculateInvestment,
  resolveInvestmentRate,
  roundToTwo,
};
