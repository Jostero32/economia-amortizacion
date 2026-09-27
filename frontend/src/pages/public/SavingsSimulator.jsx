import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { publicService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import FormInput from '../../components/FormInput';
import { LoadingState } from '../../components/Spinner';
import SavingsSchedule from '../../components/investment/SavingsSchedule';
import { todayISO, addDaysISO } from '../../utils/dates';
import { formatMoney, formatMoneyWhole, formatPercent, formatDate } from '../../utils/format';

// Duraciones habituales de un plan de ahorro (meses)
const TERM_OPTIONS = [6, 12, 18, 24, 36, 48, 60];
const MAX_START_DAYS = 90;

function resolveTierRate(product, days) {
  const rates = (product?.rates || []).filter((rate) => rate.activo !== false);
  const match = rates.find((rate) => days >= rate.plazoMinDias && days <= rate.plazoMaxDias);
  return Number(match ? match.tasa : product?.tasa);
}

function validate(form, product) {
  const errors = {};
  if (!product) return errors;
  const minMonths = Math.ceil(product.plazoMinimoDias / 30);
  const maxMonths = Math.floor(product.plazoMaximoDias / 30);
  const today = todayISO();

  if (String(form.amount).trim() === '') {
    errors.amount = 'Ingresa cuánto ahorrarás cada mes.';
  } else if (!/^\d+(\.\d{1,2})?$/.test(String(form.amount).trim())) {
    errors.amount = 'Ingresa un valor válido, sin letras y con máximo 2 decimales.';
  } else if (Number(form.amount) < Number(product.montoMinimo)) {
    errors.amount = `El aporte mínimo es ${formatMoneyWhole(product.montoMinimo)} al mes.`;
  } else if (Number(form.amount) > Number(product.montoMaximo)) {
    errors.amount = `El aporte máximo es ${formatMoneyWhole(product.montoMaximo)} al mes.`;
  }

  if (String(form.months).trim() === '') {
    errors.months = 'Ingresa la duración del plan en meses.';
  } else if (!/^\d+$/.test(String(form.months).trim())) {
    errors.months = 'La duración debe ser un número entero de meses.';
  } else if (Number(form.months) < minMonths || Number(form.months) > maxMonths) {
    errors.months = `La duración debe estar entre ${minMonths} y ${maxMonths} meses.`;
  }

  if (!form.startDate) {
    errors.startDate = 'Selecciona la fecha del primer aporte.';
  } else if (form.startDate < today) {
    errors.startDate = 'La fecha del primer aporte no puede ser anterior a hoy.';
  } else if (form.startDate > addDaysISO(today, MAX_START_DAYS)) {
    errors.startDate = `La fecha del primer aporte no puede superar ${MAX_START_DAYS} días desde hoy.`;
  }
  return errors;
}

function ResultRow({ label, value, strong = false, muted = false }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className={`text-[14px] ${muted ? 'text-gray-500' : 'text-gray-700'}`}>{label}</span>
      <span className={`font-numeric-data text-[15px] ${strong ? 'font-bold text-primary' : 'text-primary'}`}>{value}</span>
    </div>
  );
}

export default function SavingsSimulator() {
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
    amount: '100',
    months: '12',
    startDate: todayISO(),
  });
  const [customTerm, setCustomTerm] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const product = products.find((p) => String(p.id) === String(form.productId)) || products[0];
  const errors = useMemo(() => validate(form, product), [form, product]);
  const hasErrors = Object.keys(errors).length > 0;

  useEffect(() => {
    publicService
      .getInvestmentProducts()
      .then((res) => {
        const plans = (res.data?.products || []).filter((p) => p.tipo === 'AHORRO_PROGRAMADO');
        setProducts(plans);
        if (plans.length > 0 && !plans.some((p) => String(p.id) === String(form.productId))) {
          setForm((current) => ({ ...current, productId: String(plans[0].id) }));
        }
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar los planes de ahorro.'))
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
        // El plan se pacta en meses de 30 días
        termDays: Number(form.months) * 30,
        startDate: form.startDate,
      });
      setSimulation(response.data.simulation);
      setIsStale(false);
    } catch (err) {
      setError(err.message || 'No se pudo calcular el plan de ahorro. Intenta nuevamente.');
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
      navigate('/login', { state: { from: target, message: 'Inicia sesión para registrar tu plan de ahorro.' } });
    } else {
      navigate(target);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando simulador de ahorro..." />;
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Alert type="info" title="Sin planes de ahorro">No hay planes de ahorro programado activos en este momento.</Alert>
      </div>
    );
  }

  const fieldError = (field) => (showErrors ? errors[field] : undefined);
  const minMonths = Math.ceil(product.plazoMinimoDias / 30);
  const maxMonths = Math.floor(product.plazoMaximoDias / 30);
  const chips = TERM_OPTIONS.filter((m) => m >= minMonths && m <= maxMonths);
  const monthsNumber = Number(form.months);
  const tierRate = !errors.months ? resolveTierRate(product, monthsNumber * 30) : null;
  const retention = Number(simulation?.retencionIR || 0);
  const pagos = simulation?.cronogramaPagos || [];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 md:py-10 space-y-6">
      <div>
        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-2">
          <Link to="/" className="hover:text-primary">Inicio</Link>
          <span>/</span>
          <Link to="/inversiones" className="hover:text-primary">Inversiones</Link>
          <span>/</span>
          <span className="text-primary font-medium">Ahorro programado</span>
        </div>
        <h1 className="text-[28px] sm:text-[32px] font-bold text-primary tracking-tight">Simulador de ahorro programado</h1>
        <p className="text-[15px] text-on-surface-variant mt-1">
          Ahorra una cuota fija cada mes y descubre cuánto tendrás al final del plan.
        </p>
      </div>

      {error && <Alert type="error" title="No pudimos completar la operación">{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-5 bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-5"
        >
          {products.length > 1 && (
            <FormInput
              type="select"
              label="Plan"
              name="productId"
              value={form.productId}
              onChange={(e) => updateField('productId', e.target.value)}
              options={products.map((p) => ({ value: String(p.id), label: p.nombre }))}
            />
          )}

          <FormInput
            label="¿Cuánto ahorrarás cada mes?"
            name="amount"
            inputMode="decimal"
            prefix="$"
            value={form.amount}
            onChange={(e) => updateField('amount', e.target.value.replace(',', '.'))}
            onBlur={() => setShowErrors(true)}
            error={fieldError('amount')}
            hint={`Desde ${formatMoneyWhole(product.montoMinimo)} hasta ${formatMoneyWhole(product.montoMaximo)} al mes`}
          />

          <div className="space-y-1.5">
            <span className="block font-title-md text-[13px] text-primary">¿Durante cuánto tiempo?</span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {chips.map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => { setCustomTerm(false); updateField('months', String(months)); }}
                  className={`py-2 rounded-lg border text-[13px] transition-colors ${
                    !customTerm && monthsNumber === months
                      ? 'bg-secondary text-white border-secondary font-semibold'
                      : 'bg-gray-50 text-primary border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {months} meses
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomTerm(true)}
                className={`py-2 rounded-lg border text-[13px] transition-colors ${
                  customTerm ? 'bg-secondary text-white border-secondary font-semibold' : 'bg-gray-50 text-primary border-gray-200 hover:bg-gray-100'
                }`}
              >
                Otro
              </button>
            </div>
            {customTerm && (
              <FormInput
                name="months"
                inputMode="numeric"
                suffix="meses"
                value={form.months}
                onChange={(e) => updateField('months', e.target.value)}
                onBlur={() => setShowErrors(true)}
                error={fieldError('months')}
                hint={`Entre ${minMonths} y ${maxMonths} meses`}
              />
            )}
            {!customTerm && fieldError('months') && <p className="text-[11px] font-medium text-error">{fieldError('months')}</p>}
            {tierRate !== null && Number.isFinite(tierRate) && (
              <p className="text-[12px] text-gray-500">
                Tasa para {monthsNumber} meses: <strong className="text-secondary">{formatPercent(tierRate)} anual</strong>, capitalizable cada mes
              </p>
            )}
          </div>

          <details className="rounded-lg border border-gray-100 px-3 py-2" open={Boolean(fieldError('startDate'))}>
            <summary className="cursor-pointer text-[13px] text-secondary font-medium select-none">Opciones avanzadas</summary>
            <div className="pt-3">
              <FormInput
                type="date"
                label="Fecha del primer aporte"
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

        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
            {!simulation ? (
              <div className="py-10 text-center space-y-2">
                <span className="material-symbols-outlined text-[40px] text-secondary">savings</span>
                <p className="text-[15px] font-semibold text-primary">Tu resultado aparecerá aquí</p>
                <p className="text-[13px] text-gray-500">Ingresa tu aporte mensual y la duración, y pulsa «Simular».</p>
              </div>
            ) : (
              <div className={`space-y-5 ${isStale ? 'opacity-60' : ''}`}>
                <div>
                  <span className="text-[13px] text-gray-500 block">Al final de {pagos.length} meses tendrás</span>
                  <div className="text-[36px] sm:text-[40px] font-bold text-primary tracking-tight font-numeric-hero leading-tight">
                    {formatMoney(simulation.valorFinal)}
                  </div>
                  <span className="text-[13px] text-gray-500">disponible el {formatDate(simulation.fechaVencimiento)}</span>
                </div>
                <div>
                  <ResultRow label="Aporte mensual" value={formatMoney(simulation.aporteMensual)} />
                  <ResultRow label="Total aportado" value={formatMoney(simulation.monto)} />
                  <ResultRow label="Tasa de interés nominal anual" value={formatPercent(simulation.tasaAnual)} />
                  <ResultRow label="Intereses ganados" value={formatMoney(simulation.interesGanado)} />
                  <ResultRow label="Retención Impuesto a la Renta" value={retention > 0 ? `− ${formatMoney(retention)}` : 'Exento'} />
                  <ResultRow label="Ganancia neta" value={formatMoney(simulation.interesNeto)} strong />
                  <ResultRow label="Tasa efectiva anual (TEA)" value={formatPercent(simulation.tasaEfectiva)} muted />
                </div>
                <p className="text-[12px] text-gray-500">
                  Aportas al inicio de cada mes y el saldo gana intereses todos los meses. Valores referenciales.
                </p>
                {isStale && <Alert type="warning">Cambiaste los datos. Pulsa «Simular» para actualizar el resultado.</Alert>}
                <div className="flex flex-col sm:flex-row gap-3">
                  {(!isAuthenticated || isClient) && (
                    <Button variant="fintech" iconName="send" onClick={handleApply} disabled={isStale} className="sm:flex-1">
                      Solicitar este plan
                    </Button>
                  )}
                  <Button variant="outline" iconName="download" onClick={handleDownloadPdf} loading={downloading} loadingText="Descargando..." disabled={isStale} className="sm:flex-1">
                    Descargar PDF
                  </Button>
                </div>
                <button type="button" className="text-[13px] text-secondary font-medium hover:underline" onClick={() => setShowSchedule((v) => !v)}>
                  {showSchedule ? 'Ocultar aportes mes a mes' : 'Ver aportes mes a mes'}
                </button>
              </div>
            )}
          </div>

          {simulation && showSchedule && !isStale && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
              <SavingsSchedule pagos={pagos} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
