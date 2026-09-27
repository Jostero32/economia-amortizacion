import React, { useState } from 'react';
import { publicService } from '../../services/api';
import Button from '../Button';
import Alert from '../Alert';
import FormInput from '../FormInput';
import AmortizationTable from './AmortizationTable';
import { formatMoney, formatDate } from '../../utils/format';

const OPTIONS = [
  { value: 'REDUCIR_PLAZO', title: 'Reducir el plazo', detail: 'Sigues pagando la misma cuota y terminas antes. Ahorras más intereses.' },
  { value: 'REDUCIR_CUOTA', title: 'Reducir la cuota', detail: 'Mantienes el plazo y pagas cuotas más bajas.' },
];

/**
 * Simula un abono extraordinario sobre una simulación de crédito guardada
 * @param {Object} props.simulation - Simulación con su id
 * @param {Array} props.rows - Tabla de amortización original
 */
export default function PrepaymentSimulator({ simulation, rows = [] }) {
  const [afterInstallment, setAfterInstallment] = useState(Math.max(1, Math.min(6, rows.length - 1)));
  const [amount, setAmount] = useState('');
  const [option, setOption] = useState('REDUCIR_PLAZO');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTable, setShowTable] = useState(false);

  if (rows.length < 2) return null;

  const saldo = afterInstallment === 0 ? Number(simulation.monto) : Number(rows[afterInstallment - 1].saldoFinal);

  const validate = () => {
    if (String(amount).trim() === '') return 'Ingresa el valor del abono.';
    if (!/^\d+(\.\d{1,2})?$/.test(String(amount).trim())) return 'Ingresa un valor válido, con máximo 2 decimales.';
    if (Number(amount) <= 0) return 'El abono debe ser mayor a $0.';
    if (Number(amount) > saldo) return `El abono no puede superar el saldo de ${formatMoney(saldo)}.`;
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    setError(validationError);
    if (validationError) return;

    setLoading(true);
    try {
      const response = await publicService.simulateCreditPrepayment(simulation.id, {
        despuesDeCuota: afterInstallment,
        monto: Number(amount),
        opcion: option,
      });
      setResult(response.data.prepayment);
      setShowTable(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => setResult(null);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-4">
      <div>
        <h2 className="text-[16px] font-bold text-primary">Simular un abono extraordinario</h2>
        <p className="text-[13px] text-gray-500">
          Puedes pagar por anticipado sin penalidad. Elige cuándo abonar y si prefieres terminar antes o pagar cuotas más bajas.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormInput
            type="select"
            label="Abonar después de la cuota"
            name="despuesDeCuota"
            value={String(afterInstallment)}
            onChange={(e) => { setAfterInstallment(Number(e.target.value)); reset(); }}
            options={rows.slice(0, -1).map((row) => ({
              value: String(row.numeroCuota),
              label: `Cuota ${row.numeroCuota} · ${formatDate(row.fechaPago)}`,
            }))}
            hint={`Saldo de capital en ese momento: ${formatMoney(saldo)}`}
          />
          <FormInput
            label="Valor del abono"
            name="montoAbono"
            inputMode="decimal"
            prefix="$"
            value={amount}
            onChange={(e) => { setAmount(e.target.value.replace(',', '.')); reset(); }}
            error={error}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => { setOption(item.value); reset(); }}
              className={`p-3 text-left rounded-lg border transition-colors ${
                option === item.value ? 'border-secondary bg-blue-50/60' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="block text-[14px] font-bold text-primary">{item.title}</span>
              <span className="block text-[12px] text-gray-500 mt-0.5">{item.detail}</span>
            </button>
          ))}
        </div>

        <Button type="submit" variant="outline" iconName="savings" loading={loading} loadingText="Calculando...">
          Calcular abono
        </Button>
      </form>

      {result && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
              <span className="block text-[12px] text-emerald-800">Ahorras en intereses</span>
              <strong className="text-[22px] text-emerald-800 font-numeric-data">{formatMoney(result.ahorroIntereses)}</strong>
            </div>
            {result.nuevo.cuotas === 0 ? (
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 sm:col-span-2">
                <span className="block text-[12px] text-gray-500">Resultado</span>
                <strong className="text-[16px] text-primary">Con este abono cancelas el crédito por completo.</strong>
              </div>
            ) : result.opcion === 'REDUCIR_PLAZO' ? (
              <>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                  <span className="block text-[12px] text-gray-500">Cuotas que ya no pagas</span>
                  <strong className="text-[22px] text-primary font-numeric-data">{result.cuotasMenos}</strong>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                  <span className="block text-[12px] text-gray-500">Terminas de pagar</span>
                  <strong className="text-[16px] text-primary">
                    {formatDate(result.nuevo.ultimaFecha)}
                  </strong>
                  <span className="block text-[12px] text-gray-500">antes: {formatDate(result.original.ultimaFecha)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                  <span className="block text-[12px] text-gray-500">Nueva cuota</span>
                  <strong className="text-[22px] text-primary font-numeric-data">{formatMoney(result.nuevo.primeraCuota)}</strong>
                  <span className="block text-[12px] text-gray-500">antes: {formatMoney(result.original.primeraCuota)}</span>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                  <span className="block text-[12px] text-gray-500">Cuotas restantes</span>
                  <strong className="text-[22px] text-primary font-numeric-data">{result.nuevo.cuotas}</strong>
                </div>
              </>
            )}
          </div>

          <p className="text-[13px] text-gray-600">
            Saldo de {formatMoney(result.saldoAntes)} − abono de {formatMoney(result.abono)} = nuevo saldo de{' '}
            {formatMoney(result.saldoDespues)}. En total dejas de pagar {formatMoney(result.ahorroTotal)} entre
            intereses y seguros.
          </p>

          {result.nuevo.rows.length > 0 && (
            <>
              <button type="button" className="text-[13px] text-secondary font-medium hover:underline" onClick={() => setShowTable((v) => !v)}>
                {showTable ? 'Ocultar nueva tabla' : 'Ver la nueva tabla de amortización'}
              </button>
              {showTable && <AmortizationTable rows={result.nuevo.rows} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
