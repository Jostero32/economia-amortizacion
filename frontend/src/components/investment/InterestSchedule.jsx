import React from 'react';
import { formatMoney, formatDate } from '../../utils/format';

/**
 * Cronograma de pagos de intereses de un depósito con pago mensual
 */
export default function InterestSchedule({ pagos = [] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-[13px]">
        <thead className="bg-[#0b2545] text-blue-50">
          <tr>
            <th className="py-2.5 px-3 text-center font-semibold">N°</th>
            <th className="py-2.5 px-3 text-left font-semibold">Fecha</th>
            <th className="py-2.5 px-3 text-right font-semibold">Interés</th>
            <th className="py-2.5 px-3 text-right font-semibold">Retención</th>
            <th className="py-2.5 px-3 text-right font-semibold">Capital</th>
            <th className="py-2.5 px-3 text-right font-bold text-white">Recibes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 font-numeric-data">
          {pagos.map((pago) => (
            <tr key={pago.numero}>
              <td className="py-2 px-3 text-center text-gray-600">{pago.numero}</td>
              <td className="py-2 px-3 text-gray-600">{formatDate(pago.fecha)}</td>
              <td className="py-2 px-3 text-right">{formatMoney(pago.interes)}</td>
              <td className="py-2 px-3 text-right text-gray-500">{formatMoney(pago.retencion)}</td>
              <td className="py-2 px-3 text-right">{formatMoney(pago.capital)}</td>
              <td className="py-2 px-3 text-right font-bold text-primary">{formatMoney(pago.totalRecibido)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
