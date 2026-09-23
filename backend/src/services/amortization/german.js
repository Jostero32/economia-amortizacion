/**
 * Servicio de Amortización - Sistema Alemán (Amortización Constante)
 *
 * Fórmula:
 * amortizacion = P / n
 * interes = saldoInicial * i
 * cuota = amortizacion + interes
 * saldoFinal = saldoInicial - amortizacion
 *
 * Características:
 * - Amortización a capital constante
 * - Interés decreciente en cada período
 * - Cuota total decreciente mes a mes
 */

function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula la tabla de amortización bajo el sistema Alemán
 * @param {Object} params
 * @param {number} params.principal - Monto original del crédito
 * @param {number} params.monthlyRate - Tasa periódica mensual en decimal (ej: 0.0122)
 * @param {number} params.termMonths - Plazo en meses
 * @param {string|Date} params.startDate - Fecha de inicio del crédito
 * @param {Array} params.charges - Lista de cargos adicionales aplicables
 * @returns {Object} Resumen y detalle de cuotas
 */
function calculateGermanAmortization({ principal, monthlyRate, termMonths, startDate, charges = [] }) {
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

  // Amortización constante teórica a capital
  const amortizacionConstante = roundToTwo(P / n);

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
    const fechaPago = new Date(baseDate);
    fechaPago.setMonth(fechaPago.getMonth() + k);
    const fechaPagoStr = fechaPago.toISOString().split('T')[0];

    const interes = roundToTwo(saldoInicial * i);

    let capital;
    let cuota;
    let saldoFinal;

    if (k === n) {
      // Ajuste final para saldo exactamente 0.00 y suma de capital = P
      capital = roundToTwo(saldoInicial);
      cuota = roundToTwo(capital + interes);
      saldoFinal = 0.00;
    } else {
      capital = amortizacionConstante;
      if (capital > saldoInicial) {
        capital = saldoInicial;
      }
      cuota = roundToTwo(capital + interes);
      saldoFinal = roundToTwo(saldoInicial - capital);
    }

    // Cargos de esta cuota
    let cargosCuota = 0;
    charges.forEach(charge => {
      const porcentaje = Number(charge.porcentaje || 0) / 100;
      const valorFijo = Number(charge.valor || 0);

      if (charge.aplicacion === 'UNA_VEZ') {
        if (k === 1) {
          cargosCuota += (charge.tipo === 'PORCENTAJE') ? roundToTwo(P * porcentaje) : roundToTwo(valorFijo);
        }
      } else if (charge.aplicacion === 'POR_CUOTA' || charge.aplicacion === 'MENSUAL') {
        if (charge.baseCalculo === 'SALDO_INSOLUTO') {
          cargosCuota += (charge.tipo === 'PORCENTAJE') ? roundToTwo(saldoInicial * porcentaje) : roundToTwo(valorFijo);
        } else {
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
    sistema: 'ALEMAN',
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
  calculateGermanAmortization,
  roundToTwo,
};
