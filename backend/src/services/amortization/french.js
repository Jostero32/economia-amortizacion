/**
 * Servicio de Amortización - Sistema Francés (Cuotas Constantes)
 *
 * Fórmula de la cuota:
 * C = P * [ i(1+i)^n ] / [ (1+i)^n - 1 ]
 *
 * Donde:
 * P = Principal (Monto del préstamo)
 * i = Tasa de interés periódica mensual
 * n = Número total de cuotas (plazo en meses)
 */

function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula la tabla de amortización bajo el sistema Francés
 * @param {Object} params
 * @param {number} params.principal - Monto original del crédito
 * @param {number} params.monthlyRate - Tasa periódica mensual en decimal (ej: 0.0122)
 * @param {number} params.termMonths - Plazo en meses
 * @param {string|Date} params.startDate - Fecha de inicio del crédito
 * @param {Array} params.charges - Lista de cargos adicionales aplicables
 * @returns {Object} Resumen y detalle de cuotas
 */
function calculateFrenchAmortization({ principal, monthlyRate, termMonths, startDate, charges = [] }) {
  if (principal <= 0) {
    throw new Error('El monto del crédito debe ser mayor a cero.');
  }
  if (termMonths <= 0 || !Number.isInteger(termMonths)) {
    throw new Error('El plazo en meses debe ser un entero positivo mayor a cero.');
  }
  if (monthlyRate < 0) {
    throw new Error('La tasa de interés no puede ser negativa.');
  }

  const P = Number(principal);
  const i = Number(monthlyRate);
  const n = Number(termMonths);

  // Cuota constante antes de cargos
  let cuotaConstante;
  if (i === 0) {
    cuotaConstante = P / n;
  } else {
    const factor = Math.pow(1 + i, n);
    cuotaConstante = P * ((i * factor) / (factor - 1));
  }

  const rows = [];
  let saldoInicial = P;
  let totalCapital = 0;
  let totalIntereses = 0;
  let totalCargos = 0;

  const baseDate = startDate ? new Date(startDate) : new Date();

  // Desglose de cargos
  const desgloseCargos = [];
  charges.forEach(charge => {
    let valorCalculado = 0;
    const porcentaje = Number(charge.porcentaje || 0) / 100;
    const valorFijo = Number(charge.valor || 0);

    if (charge.tipo === 'PORCENTAJE') {
      valorCalculado = roundToTwo(P * porcentaje);
    } else {
      valorCalculado = roundToTwo(valorFijo);
    }

    desgloseCargos.push({
      id: charge.id,
      nombre: charge.nombre,
      tipo: charge.tipo,
      aplicacion: charge.aplicacion,
      valor: valorCalculado,
      porcentaje: charge.porcentaje,
    });
  });

  for (let k = 1; k <= n; k++) {
    // Fecha de pago de la cuota: mes a mes
    const fechaPago = new Date(baseDate);
    fechaPago.setMonth(fechaPago.getMonth() + k);
    const fechaPagoStr = fechaPago.toISOString().split('T')[0];

    // Interés del período sobre saldo inicial
    const interes = roundToTwo(saldoInicial * i);

    let capital;
    let cuota;
    let saldoFinal;

    if (k === n) {
      // Ajuste de última cuota por redondeo de centavos
      capital = roundToTwo(saldoInicial);
      cuota = roundToTwo(capital + interes);
      saldoFinal = 0.00;
    } else {
      capital = roundToTwo(cuotaConstante - interes);
      // Garantizar que no exceda el saldo si hay desviaciones por centavos
      if (capital > saldoInicial) {
        capital = saldoInicial;
      }
      cuota = roundToTwo(capital + interes);
      saldoFinal = roundToTwo(saldoInicial - capital);
    }

    // Calcular cargos para esta cuota específica
    let cargosCuota = 0;
    charges.forEach(charge => {
      const porcentaje = Number(charge.porcentaje || 0) / 100;
      const valorFijo = Number(charge.valor || 0);

      if (charge.aplicacion === 'UNA_VEZ') {
        if (k === 1) {
          // Se aplica en la primera cuota
          cargosCuota += (charge.tipo === 'PORCENTAJE') ? roundToTwo(P * porcentaje) : roundToTwo(valorFijo);
        }
      } else if (charge.aplicacion === 'POR_CUOTA' || charge.aplicacion === 'MENSUAL') {
        if (charge.baseCalculo === 'SALDO_INSOLUTO') {
          cargosCuota += (charge.tipo === 'PORCENTAJE') ? roundToTwo(saldoInicial * porcentaje) : roundToTwo(valorFijo);
        } else {
          // Por defecto sobre monto o fijo por cuota
          cargosCuota += (charge.tipo === 'PORCENTAJE') ? roundToTwo((P / n) * porcentaje) : roundToTwo(valorFijo);
        }
      }
    });

    cargosCuota = roundToTwo(cargosCuota);
    const totalPago = roundToTwo(cuota + cargosCuota);

    totalCapital = roundToTwo(totalCapital + capital);
    totalIntereses = roundToTwo(totalIntereses + interes);
    totalCargos = roundToTwo(totalCargos + cargosCuota);

    rows.push({
      numeroCuota: k,
      fechaPago: fechaPagoStr,
      saldoInicial: roundToTwo(saldoInicial),
      cuota,
      capital,
      interes,
      cargos: cargosCuota,
      totalPago,
      saldoFinal,
    });

    saldoInicial = saldoFinal;
  }

  const totalPagar = roundToTwo(totalCapital + totalIntereses + totalCargos);

  return {
    sistema: 'FRANCES',
    monto: P,
    plazoMeses: n,
    cuotaInicial: rows[0] ? rows[0].cuota : 0,
    totalCapital,
    totalIntereses,
    totalCargos,
    totalPagar,
    desgloseCargos,
    rows,
  };
}

module.exports = {
  calculateFrenchAmortization,
  roundToTwo,
};
