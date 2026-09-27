import React from 'react';
import { formatMoney, formatDate } from '../../utils/format';

/**
 * Tabla de amortización: capital, interés y seguros/otros cargos de cada cuota por separado,
 * como exige la Superintendencia de Bancos en la información previa al crédito.
 */
export default function AmortizationTable({ rows = [], simulation }) {
  const hasCharges = rows.some((row) => Number(row.cargos) > 0);
  const sum = (field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-[13px]">
        <thead className="bg-[#0b2545] text-blue-50">
          <tr>
            <th className="py-3 px-3 text-center font-semibold">N°</th>
            <th className="py-3 px-3 text-left font-semibold">Fecha de pago</th>
            <th className="py-3 px-3 text-right font-semibold">Saldo inicial</th>
            <th className="py-3 px-3 text-right font-semibold">Capital</th>
            <th className="py-3 px-3 text-right font-semibold">Interés</th>
            {hasCharges && <th className="py-3 px-3 text-right font-semibold">Seguros y otros cargos</th>}
            <th className="py-3 px-3 text-right font-bold text-white">Cuota a pagar</th>
            <th className="py-3 px-3 text-right font-semibold">Saldo final</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 font-numeric-data">
          {rows.map((row) => (
            <tr key={row.numeroCuota} className="hover:bg-blue-50/40">
              <td className="py-2 px-3 text-center text-gray-600">{row.numeroCuota}</td>
              <td className="py-2 px-3 text-gray-600">{formatDate(row.fechaPago)}</td>
              <td className="py-2 px-3 text-right">{formatMoney(row.saldoInicial)}</td>
              <td className="py-2 px-3 text-right text-primary">{formatMoney(row.capital)}</td>
              <td className="py-2 px-3 text-right text-secondary">{formatMoney(row.interes)}</td>
              {hasCharges && <td className="py-2 px-3 text-right text-gray-500">{formatMoney(row.cargos)}</td>}
              <td className="py-2 px-3 text-right font-bold text-primary">{formatMoney(row.totalPago)}</td>
              <td className="py-2 px-3 text-right text-gray-600">{formatMoney(row.saldoFinal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-[#e6eeff] font-bold font-numeric-data text-primary">
          <tr>
            <td className="py-3 px-3" colSpan={3}>Totales</td>
            <td className="py-3 px-3 text-right">{formatMoney(simulation?.totalCapital ?? sum('capital'))}</td>
            <td className="py-3 px-3 text-right">{formatMoney(simulation?.totalIntereses ?? sum('interes'))}</td>
            {hasCharges && <td className="py-3 px-3 text-right">{formatMoney(sum('cargos'))}</td>}
            <td className="py-3 px-3 text-right">{formatMoney(simulation?.totalPagar ?? sum('totalPago'))}</td>
            <td className="py-3 px-3 text-right">{formatMoney(0)}</td>
          </tr>
        </tfoot>
        {simulation?.sistemaAmortizacion === 'ALEMAN' && (
          <caption className="caption-bottom py-2 px-3 text-left text-[12px] text-gray-500">
            La última cuota ajusta los centavos de redondeo del abono a capital.
          </caption>
        )}
      </table>
    </div>
  );
}
