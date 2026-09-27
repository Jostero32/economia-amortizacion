import React from 'react';
import { formatMoney, formatDate } from '../../utils/format';

/**
 * Aportes mensuales de un ahorro programado con el interés del mes y el saldo acumulado
 */
export default function SavingsSchedule({ pagos = [] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-[13px]">
        <thead className="bg-[#0b2545] text-blue-50">
          <tr>
            <th className="py-2.5 px-3 text-center font-semibold">Mes</th>
            <th className="py-2.5 px-3 text-left font-semibold">Fecha de aporte</th>
            <th className="py-2.5 px-3 text-right font-semibold">Aporte</th>
            <th className="py-2.5 px-3 text-right font-semibold">Interés del mes</th>
            <th className="py-2.5 px-3 text-right font-bold text-white">Saldo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 font-numeric-data">
          {pagos.map((pago) => (
            <tr key={pago.numero}>
              <td className="py-2 px-3 text-center text-gray-600">{pago.numero}</td>
              <td className="py-2 px-3 text-gray-600">{formatDate(pago.fecha)}</td>
              <td className="py-2 px-3 text-right">{formatMoney(pago.aporte)}</td>
              <td className="py-2 px-3 text-right text-emerald-700">{formatMoney(pago.interes)}</td>
              <td className="py-2 px-3 text-right font-bold text-primary">{formatMoney(pago.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
