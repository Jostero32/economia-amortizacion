import React from 'react';
import { formatMoney, formatPercent, formatDate } from '../../utils/format';
import { getFrequency } from '../../utils/frequencies';

// Referencia usual de endeudamiento: la cuota no debería superar el 40 % del ingreso mensual
export const MAX_DEBT_TO_INCOME = 0.4;

function Row({ label, value, hint, strong = false, negative = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <div>
        <span className={`text-[14px] ${strong ? 'font-semibold text-primary' : 'text-gray-700'}`}>{label}</span>
        {hint && <span className="block text-[12px] text-gray-500">{hint}</span>}
      </div>
      <span className={`font-numeric-data text-[15px] whitespace-nowrap ${strong ? 'font-bold text-primary' : 'text-primary'}`}>
        {negative ? `− ${value}` : value}
      </span>
    </div>
  );
}

/**
 * Resumen del crédito con la información que un banco entrega antes de contratar:
 * cuota, valor a recibir, tasa nominal y efectiva, intereses, seguros y costo total.
 */
export default function CreditSummary({ simulation, rows = [], tasaMaximaBCE }) {
  const tea = Number(simulation.tasaAnual);
  const tasaNominal = simulation.tasaNominal != null
    ? Number(simulation.tasaNominal)
    : 12 * (Math.pow(1 + tea / 100, 1 / 12) - 1) * 100;
  const cargosDesembolso = Number(simulation.cargosDesembolso || 0);
  const montoLiquido = simulation.montoLiquido != null
    ? Number(simulation.montoLiquido)
    : Number(simulation.monto) - cargosDesembolso;

  const desglose = simulation.desgloseCargos || [];
  const disbursementNames = desglose
    .filter((cargo) => cargo.momento === 'DESEMBOLSO' && Number(cargo.valor) > 0)
    .map((cargo) => cargo.nombre);
  const insuranceTotal = rows.reduce((total, row) => total + Number(row.cargos || 0), 0);

  const firstPayment = Number(rows[0]?.totalPago ?? simulation.cuotaInicial);
  const firstInsurance = Number(rows[0]?.cargos || 0);
  const maxPayment = rows.reduce((max, row) => Math.max(max, Number(row.totalPago)), firstPayment);
  const isGerman = simulation.sistemaAmortizacion === 'ALEMAN';
  const frecuencia = getFrequency(simulation.frecuenciaPago);
  const cuotas = rows.length || simulation.plazoMeses;
  // Con pagos no mensuales se compara el ingreso con la cuota mensual equivalente
  const maxMonthlyPayment = maxPayment / frecuencia.meses;

  return (
    <div className="space-y-5">
      <div>
        <span className="text-[13px] text-gray-500 block">
          {isGerman
            ? `Primera cuota ${frecuencia.cuota} (luego disminuye)`
            : `Cuota ${frecuencia.cuota} fija`}
        </span>
        <div className="text-[36px] sm:text-[40px] font-bold text-primary tracking-tight font-numeric-hero leading-tight">
          {formatMoney(firstPayment)}
        </div>
        <span className="text-[13px] text-gray-500">
          {cuotas} cuotas {frecuencia.plural}
          {rows[0] && ` · primer pago el ${formatDate(rows[0].fechaPago)}`}
          {firstInsurance > 0 && ` · incluye ${formatMoney(firstInsurance)} de seguro`}
        </span>
      </div>

      <div>
        <Row label="Monto solicitado" value={formatMoney(simulation.monto)} />
        {cargosDesembolso > 0 && (
          <Row
            label="Retenido al desembolso"
            hint={disbursementNames.join(', ') || 'Contribución SOLCA'}
            value={formatMoney(cargosDesembolso)}
            negative
          />
        )}
        <Row label="Valor que recibes" value={formatMoney(montoLiquido)} strong />
        <Row
          label="Tasa de interés nominal anual"
          hint={`Es la que figura en el contrato (pagos ${frecuencia.plural})`}
          value={formatPercent(tasaNominal)}
        />
        <Row
          label="Tasa efectiva anual (TEA)"
          hint={tasaMaximaBCE ? `Máximo permitido por el BCE: ${formatPercent(tasaMaximaBCE)}` : undefined}
          value={formatPercent(tea)}
        />
        <Row label="Total de intereses" value={formatMoney(simulation.totalIntereses)} />
        {insuranceTotal > 0 && <Row label="Total de seguros" value={formatMoney(insuranceTotal)} />}
        {simulation.polizaDesgravamenPropia && (
          <Row label="Seguro de desgravamen" hint="Endosarás tu propia póliza a favor de la institución" value="Póliza propia" />
        )}
        <Row label="Total a pagar en cuotas" value={formatMoney(simulation.totalPagar)} strong />
        {simulation.costoEfectivoAnual != null && (
          <Row
            label="Costo efectivo anual"
            hint="Incluye intereses, seguros y SOLCA (referencial)"
            value={formatPercent(simulation.costoEfectivoAnual)}
          />
        )}
      </div>

      <p className="text-[12px] text-gray-500 bg-gray-50 rounded-lg p-3">
        Ingreso mensual sugerido: <strong className="text-primary">{formatMoney(maxMonthlyPayment / MAX_DEBT_TO_INCOME)}</strong>.
        Se recomienda que tus cuotas no superen el 40 % de tus ingresos.
      </p>
    </div>
  );
}
