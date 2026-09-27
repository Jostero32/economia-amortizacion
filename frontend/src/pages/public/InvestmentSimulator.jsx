import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { publicService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import FormInput from '../../components/FormInput';
import { LoadingState } from '../../components/Spinner';
import { todayISO, addDaysISO } from '../../utils/dates';
import { formatMoney, formatMoneyWhole, formatPercent, formatDate } from '../../utils/format';

// Plazos habituales de un depósito a plazo fijo (días calendario)
const TERM_OPTIONS = [30, 60, 90, 180, 360, 720];
// La fecha de apertura se puede programar hasta 90 días después de hoy
const MAX_START_DAYS = 90;
const COSEDE_LIMIT = 32000;
const EXEMPT_TERM_DAYS = 180;

function resolveTierRate(product, days) {
  const rates = (product?.rates || []).filter((rate) => rate.activo !== false);
  const match = rates.find((rate) => days >= rate.plazoMinDias && days <= rate.plazoMaxDias);
  return Number(match ? match.tasa : product?.tasa);
}

function validate(form, product) {
  const errors = {};
  const min = Number(product?.montoMinimo || 0);
  const max = Number(product?.montoMaximo || Infinity);
  const minDays = Number(product?.plazoMinimoDias || 30);
  const maxDays = Number(product?.plazoMaximoDias || 1080);
  const today = todayISO();

  if (String(form.amount).trim() === '') {
    errors.amount = 'Ingresa el monto que deseas invertir.';
  } else if (!/^\d+(\.\d{1,2})?$/.test(String(form.amount).trim())) {
    errors.amount = 'Ingresa un monto válido, sin letras y con máximo 2 decimales.';
  } else if (Number(form.amount) < min) {
    errors.amount = `El monto mínimo es ${formatMoneyWhole(min)}.`;
  } else if (Number(form.amount) > max) {
    errors.amount = `El monto máximo es ${formatMoneyWhole(max)}.`;
  }

  if (String(form.termDays).trim() === '') {
    errors.termDays = 'Ingresa el plazo en días.';
  } else if (!/^\d+$/.test(String(form.termDays).trim())) {
    errors.termDays = 'El plazo debe ser un número entero de días.';
  } else if (Number(form.termDays) < minDays || Number(form.termDays) > maxDays) {
    errors.termDays = `El plazo debe estar entre ${minDays} y ${maxDays} días.`;
  }

  if (!form.startDate) {
    errors.startDate = 'Selecciona la fecha de apertura.';
  } else if (form.startDate < today) {
    errors.startDate = 'La fecha de apertura no puede ser anterior a hoy.';
  } else if (form.startDate > addDaysISO(today, MAX_START_DAYS)) {
    errors.startDate = `La fecha de apertura no puede superar ${MAX_START_DAYS} días desde hoy.`;
  }

  return errors;
}

function ResultRow({ label, value, strong = false, muted = false }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className={`text-[14px] ${muted ? 'text-gray-500' : 'text-gray-700'}`}>{label}</span>
      <span className={`font-numeric-data text-[15px] ${strong ? 'font-bold text-primary' : 'text-primary'}`}>
        {value}
      </span>
    </div>
  );
}

export default function InvestmentSimulator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isClient } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    productId: searchParams.get('productId') || '',
    amount: '10000',
    termDays: '360',
    startDate: todayISO(),
  });
  const [customTerm, setCustomTerm] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [isStale, setIsStale] = useState(false);

  const product = products.find((p) => String(p.id) === String(form.productId)) || products[0];
  const errors = useMemo(() => validate(form, product), [form, product]);
  const hasErrors = Object.keys(errors).length > 0;

  const termOptions = TERM_OPTIONS.filter(
    (days) => days >= (product?.plazoMinimoDias || 30) && days <= (product?.plazoMaximoDias || 1080)
  );
  const termDaysNumber = Number(form.termDays);
  const tierRate = !errors.termDays && product ? resolveTierRate(product, termDaysNumber) : null;
  const sortedRates = [...(product?.rates || [])]
    .filter((rate) => rate.activo !== false)
    .sort((a, b) => a.plazoMinDias - b.plazoMinDias);

  useEffect(() => {
    publicService
      .getInvestmentProducts()
      .then((res) => {
        const prods = res.data?.products || [];
        setProducts(prods);
        if (prods.length > 0 && !prods.some((p) => String(p.id) === String(form.productId))) {
          setForm((current) => ({ ...current, productId: String(prods[0].id) }));
        }
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar los productos de inversión.'))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (simulation) setIsStale(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setShowErrors(true);
    if (hasErrors) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await publicService.simulateInvestment({
        investmentProductId: Number(product.id),
        amount: Number(form.amount),
        termDays: Number(form.termDays),
        startDate: form.startDate,
      });
      setSimulation(response.data.simulation);
      setIsStale(false);
    } catch (err) {
      setError(err.message || 'No se pudo calcular la inversión. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      await publicService.downloadInvestmentSimulationPdf(simulation.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleApply = () => {
    const target = `/cliente/solicitudes?invSimulationId=${simulation.id}`;
    if (!isAuthenticated) {
      navigate('/login', {
        state: { from: target, message: 'Inicia sesión para registrar tu solicitud de inversión.' },
      });
    } else {
      navigate(target);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando simulador de inversiones..." />;
  }

  const fieldError = (field) => (showErrors ? errors[field] : undefined);
  const retention = Number(simulation?.retencionIR || 0);
  const grossInterest = Number(simulation?.interesGanado || 0);
  const netInterest = Number(simulation?.interesNeto ?? grossInterest - retention);
  const simulatedDays = Number(simulation?.plazoDias || 0);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 md:py-10 space-y-6">
      <div>
        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-2">
          <Link to="/" className="hover:text-primary">Inicio</Link>
          <span>/</span>
          <Link to="/inversiones" className="hover:text-primary">Inversiones</Link>
          <span>/</span>
          <span className="text-primary font-medium">Simulador</span>
        </div>
        <h1 className="text-[28px] sm:text-[32px] font-bold text-primary tracking-tight">
          Simulador de inversiones
        </h1>
        <p className="text-[15px] text-on-surface-variant mt-1">
          Calcula cuánto recibirás al vencimiento de tu depósito a plazo fijo.
        </p>
      </div>

      {error && <Alert type="error" title="No pudimos completar la operación">{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Datos de la inversión */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-5 bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-5"
        >
          {products.length > 1 && (
            <FormInput
              type="select"
              label="Producto"
              name="productId"
              value={form.productId}
              onChange={(e) => updateField('productId', e.target.value)}
              options={products.map((p) => ({ value: String(p.id), label: p.nombre }))}
            />
          )}

          <FormInput
            label="¿Cuánto quieres invertir?"
            name="amount"
            inputMode="decimal"
            prefix="$"
            value={form.amount}
            onChange={(e) => updateField('amount', e.target.value.replace(',', '.'))}
            onBlur={() => setShowErrors(true)}
            error={fieldError('amount')}
            hint={
              product
                ? `Desde ${formatMoneyWhole(product.montoMinimo)} hasta ${formatMoneyWhole(product.montoMaximo)}`
                : undefined
            }
          />

          <div className="space-y-1.5">
            <span className="block font-title-md text-[13px] text-primary">¿Por cuánto tiempo?</span>
            <div className="grid grid-cols-3 gap-2">
              {termOptions.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    setCustomTerm(false);
                    updateField('termDays', String(days));
                  }}
                  className={`py-2 rounded-lg border text-[13px] transition-colors ${
                    !customTerm && termDaysNumber === days
                      ? 'bg-secondary text-white border-secondary font-semibold'
                      : 'bg-gray-50 text-primary border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {days} días
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomTerm(true)}
                className={`py-2 rounded-lg border text-[13px] transition-colors ${
                  customTerm
                    ? 'bg-secondary text-white border-secondary font-semibold'
                    : 'bg-gray-50 text-primary border-gray-200 hover:bg-gray-100'
                }`}
              >
                Otro plazo
              </button>
            </div>
            {customTerm && (
              <FormInput
                name="termDays"
                inputMode="numeric"
                suffix="días"
                value={form.termDays}
                onChange={(e) => updateField('termDays', e.target.value)}
                onBlur={() => setShowErrors(true)}
                error={fieldError('termDays')}
                hint={`Entre ${product?.plazoMinimoDias || 30} y ${product?.plazoMaximoDias || 1080} días`}
              />
            )}
            {!customTerm && fieldError('termDays') && (
              <p className="text-[11px] font-medium text-error">{fieldError('termDays')}</p>
            )}
            {tierRate !== null && Number.isFinite(tierRate) && (
              <p className="text-[12px] text-gray-500">
                Tasa para {termDaysNumber} días: <strong className="text-secondary">{formatPercent(tierRate)} anual</strong>
              </p>
            )}
          </div>

          <details className="group rounded-lg border border-gray-100 px-3 py-2" open={Boolean(fieldError('startDate'))}>
            <summary className="cursor-pointer text-[13px] text-secondary font-medium select-none">
              Opciones avanzadas
            </summary>
            <div className="pt-3">
              <FormInput
                type="date"
                label="Fecha de apertura"
                name="startDate"
                value={form.startDate}
                min={todayISO()}
                max={addDaysISO(todayISO(), MAX_START_DAYS)}
                onChange={(e) => updateField('startDate', e.target.value)}
                error={fieldError('startDate')}
              />
            </div>
          </details>

          <Button type="submit" variant="fintech" size="lg" className="w-full" loading={submitting} loadingText="Calculando...">
            Simular
          </Button>
        </form>

        {/* Resultado */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
            {!simulation ? (
              <div className="py-10 text-center space-y-2">
                <span className="material-symbols-outlined text-[40px] text-secondary">savings</span>
                <p className="text-[15px] font-semibold text-primary">Tu resultado aparecerá aquí</p>
                <p className="text-[13px] text-gray-500">Ingresa el monto y el plazo, y pulsa «Simular».</p>
              </div>
            ) : (
              <div className={`space-y-5 ${isStale ? 'opacity-60' : ''}`}>
                <div>
                  <span className="text-[13px] text-gray-500 block">Recibirás al vencimiento</span>
                  <div className="text-[36px] sm:text-[40px] font-bold text-primary tracking-tight font-numeric-hero">
                    {formatMoney(simulation.valorFinal)}
                  </div>
                  <span className="text-[13px] text-gray-500">
                    el {formatDate(simulation.fechaVencimiento)} · {simulatedDays} días
                  </span>
                </div>

                <div>
                  <ResultRow label="Capital invertido" value={formatMoney(simulation.monto)} />
                  <ResultRow label="Tasa de interés nominal anual" value={formatPercent(simulation.tasaAnual)} />
                  <ResultRow label="Interés ganado" value={formatMoney(grossInterest)} />
                  <ResultRow
                    label={
                      retention > 0
                        ? `Retención Impuesto a la Renta (${formatPercent(simulation.tasaRetencion, 2, 0)})`
                        : 'Retención Impuesto a la Renta'
                    }
                    value={retention > 0 ? `− ${formatMoney(retention)}` : 'Exento'}
                  />
                  <ResultRow label="Ganancia neta" value={formatMoney(netInterest)} strong />
                  {simulation.tasaEfectiva != null && (
                    <ResultRow
                      label="Tasa efectiva anual (TEA)"
                      value={formatPercent(simulation.tasaEfectiva)}
                      muted
                    />
                  )}
                </div>

                <div className="text-[12px] text-gray-500 space-y-1">
                  <p>
                    {simulatedDays >= EXEMPT_TERM_DAYS
                      ? 'Los intereses de depósitos a 180 días o más están exentos de retención.'
                      : 'A plazos menores de 180 días se retiene el 3 % de los intereses como Impuesto a la Renta.'}
                  </p>
                  {Number(simulation.monto) > COSEDE_LIMIT && (
                    <p>El seguro de depósitos COSEDE cubre hasta {formatMoneyWhole(COSEDE_LIMIT)} por persona en cada entidad.</p>
                  )}
                  <p>Valores referenciales. Las condiciones finales se confirman al abrir el depósito.</p>
                </div>

                {isStale && (
                  <Alert type="warning">Cambiaste los datos. Pulsa «Simular» para actualizar el resultado.</Alert>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  {(!isAuthenticated || isClient) && (
                    <Button variant="fintech" iconName="send" onClick={handleApply} disabled={isStale} className="sm:flex-1">
                      Solicitar esta inversión
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    iconName="download"
                    onClick={handleDownloadPdf}
                    loading={downloading}
                    loadingText="Descargando..."
                    disabled={isStale}
                    className="sm:flex-1"
                  >
                    Descargar PDF
                  </Button>
                </div>
              </div>
            )}
          </div>

          {sortedRates.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
              <h2 className="text-[15px] font-bold text-primary mb-3">Tasas según el plazo</h2>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="text-left font-medium py-2">Plazo</th>
                    <th className="text-right font-medium py-2">Tasa nominal anual</th>
                  </tr>
                </thead>
                <tbody className="font-numeric-data">
                  {sortedRates.map((rate) => {
                    const isCurrent = termDaysNumber >= rate.plazoMinDias && termDaysNumber <= rate.plazoMaxDias;
                    return (
                      <tr key={rate.id} className={isCurrent ? 'bg-blue-50 font-semibold text-primary' : 'text-gray-700'}>
                        <td className="py-2 px-2">{rate.plazoMinDias} a {rate.plazoMaxDias} días</td>
                        <td className="py-2 px-2 text-right">{formatPercent(rate.tasa)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
