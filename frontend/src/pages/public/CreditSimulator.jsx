import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { publicService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import FormInput from '../../components/FormInput';
import Modal from '../../components/Modal';
import { LoadingState } from '../../components/Spinner';
import CreditSummary from '../../components/credit/CreditSummary';
import AmortizationTable from '../../components/credit/AmortizationTable';
import { todayISO, addDaysISO } from '../../utils/dates';
import { formatMoney, formatMoneyWhole, formatPercent } from '../../utils/format';

// Plazos habituales en meses; se muestran los que caben en el rango del producto
const TERM_OPTIONS = [6, 12, 18, 24, 36, 48, 60, 72, 120, 180, 240];
const MAX_TERM_CHIPS = 6;
// La fecha de desembolso se puede programar hasta 90 días después de hoy
const MAX_START_DAYS = 90;

const SYSTEMS = [
  { value: 'FRANCES', title: 'Cuota fija', detail: 'Pagas lo mismo cada mes (sistema francés).' },
  { value: 'ALEMAN', title: 'Cuota decreciente', detail: 'Empiezas pagando más y la cuota baja cada mes (sistema alemán).' },
];

function termChips(product) {
  const options = TERM_OPTIONS.filter((m) => m >= product.plazoMinimo && m <= product.plazoMaximo);
  if (options.length <= MAX_TERM_CHIPS) return options;
  // Repartir las opciones a lo largo del rango para no saturar la pantalla
  const step = (options.length - 1) / (MAX_TERM_CHIPS - 1);
  return Array.from({ length: MAX_TERM_CHIPS }, (_, index) => options[Math.round(index * step)]);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function validate(form, product) {
  const errors = {};
  if (!product) return errors;
  const today = todayISO();

  if (String(form.amount).trim() === '') {
    errors.amount = 'Ingresa el monto que necesitas.';
  } else if (!/^\d+(\.\d{1,2})?$/.test(String(form.amount).trim())) {
    errors.amount = 'Ingresa un monto válido, sin letras y con máximo 2 decimales.';
  } else if (Number(form.amount) < Number(product.montoMinimo)) {
    errors.amount = `El monto mínimo para este crédito es ${formatMoneyWhole(product.montoMinimo)}.`;
  } else if (Number(form.amount) > Number(product.montoMaximo)) {
    errors.amount = `El monto máximo para este crédito es ${formatMoneyWhole(product.montoMaximo)}.`;
  }

  if (String(form.termMonths).trim() === '') {
    errors.termMonths = 'Ingresa el plazo en meses.';
  } else if (!/^\d+$/.test(String(form.termMonths).trim())) {
    errors.termMonths = 'El plazo debe ser un número entero de meses.';
  } else if (Number(form.termMonths) < product.plazoMinimo || Number(form.termMonths) > product.plazoMaximo) {
    errors.termMonths = `El plazo debe estar entre ${product.plazoMinimo} y ${product.plazoMaximo} meses.`;
  }

  if (!form.startDate) {
    errors.startDate = 'Selecciona la fecha de desembolso.';
  } else if (form.startDate < today) {
    errors.startDate = 'La fecha de desembolso no puede ser anterior a hoy.';
  } else if (form.startDate > addDaysISO(today, MAX_START_DAYS)) {
    errors.startDate = `La fecha de desembolso no puede superar ${MAX_START_DAYS} días desde hoy.`;
  }

  return errors;
}

export default function CreditSimulator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isClient } = useAuth();

  const [products, setProducts] = useState([]);
  const [generalCharges, setGeneralCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    creditTypeId: searchParams.get('creditTypeId') || '',
    amount: searchParams.get('monto') || '10000',
    termMonths: searchParams.get('plazo') || '24',
    system: 'FRANCES',
    startDate: todayISO(),
  });
  const [acceptedOptional, setAcceptedOptional] = useState([]);
  const [customTerm, setCustomTerm] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [simulation, setSimulation] = useState(null);
  const [rows, setRows] = useState([]);
  const [productInfo, setProductInfo] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const product = products.find((p) => String(p.id) === String(form.creditTypeId)) || products[0];
  const errors = useMemo(() => validate(form, product), [form, product]);
  const hasErrors = Object.keys(errors).length > 0;

  // Cargos que el cliente puede decidir si contrata (en vivienda el desgravamen es obligatorio)
  const optionalCharges = useMemo(() => {
    if (!product) return [];
    return [...generalCharges, ...(product.charges || [])].filter(
      (charge) =>
        charge.activo !== false &&
        !charge.obligatorio &&
        !(charge.categoria === 'SEGURO_DESGRAVAMEN' && product.requiereDesgravamen)
    );
  }, [product, generalCharges]);

  useEffect(() => {
    publicService
      .getCreditProducts()
      .then((res) => {
        const prods = res.data?.products || [];
        setProducts(prods);
        setGeneralCharges(res.data?.generalCharges || []);
        if (prods.length > 0 && !prods.some((p) => String(p.id) === String(form.creditTypeId))) {
          setForm((current) => ({ ...current, creditTypeId: String(prods[0].id) }));
        }
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar los tipos de crédito.'))
      .finally(() => setLoading(false));
  }, []);

  // Al cambiar de producto se aceptan por defecto sus cargos opcionales (casilla marcada)
  useEffect(() => {
    setAcceptedOptional(optionalCharges.map((charge) => charge.id));
  }, [optionalCharges]);

  const markStale = () => {
    if (simulation) setIsStale(true);
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    markStale();
  };

  const handleProductChange = (id) => {
    const next = products.find((p) => String(p.id) === String(id));
    setForm((current) => {
      const amount = Number(current.amount);
      const term = Number(current.termMonths);
      return {
        ...current,
        creditTypeId: id,
        // Ajustar monto y plazo a los límites del nuevo producto
        amount: Number.isFinite(amount) && amount > 0
          ? String(clamp(amount, Number(next.montoMinimo), Number(next.montoMaximo)))
          : current.amount,
        termMonths: Number.isInteger(term) && term > 0
          ? String(clamp(term, next.plazoMinimo, next.plazoMaximo))
          : current.termMonths,
      };
    });
    setCustomTerm(false);
    markStale();
  };

  const toggleOptional = (id) => {
    setAcceptedOptional((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    markStale();
  };

  const requestPayload = () => ({
    creditTypeId: Number(product.id),
    amount: Number(form.amount),
    termMonths: Number(form.termMonths),
    startDate: form.startDate,
    cargosOpcionales: acceptedOptional,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setShowErrors(true);
    if (hasErrors) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await publicService.simulateCredit({ ...requestPayload(), amortizationSystem: form.system });
      setSimulation(response.data.simulation);
      setRows(response.data.rows || []);
      setProductInfo(response.data.product);
      setIsStale(false);
    } catch (err) {
      setError(err.message || 'No se pudo calcular el crédito. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompare = async () => {
    setShowErrors(true);
    if (hasErrors) return;

    setShowComparison(true);
    setComparing(true);
    setComparison(null);
    try {
      const response = await publicService.compareCreditSystems(requestPayload());
      setComparison(response.data);
    } catch (err) {
      setShowComparison(false);
      setError(err.message || 'No se pudo comparar los sistemas de amortización.');
    } finally {
      setComparing(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      await publicService.downloadCreditSimulationPdf(simulation.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleApply = () => {
    const target = `/cliente/solicitudes?simulationId=${simulation.id}`;
    if (!isAuthenticated) {
      navigate('/login', {
        state: { from: target, message: 'Inicia sesión para registrar tu solicitud de crédito.' },
      });
    } else {
      navigate(target);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando simulador de crédito..." />;
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Alert type="error" title="Simulador no disponible">
          {error || 'No hay productos de crédito activos en este momento.'}
        </Alert>
      </div>
    );
  }

  const fieldError = (field) => (showErrors ? errors[field] : undefined);
  const chips = termChips(product);
  const termMonthsNumber = Number(form.termMonths);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 md:py-10 space-y-6">
      <div>
        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-2">
          <Link to="/" className="hover:text-primary">Inicio</Link>
          <span>/</span>
          <Link to="/creditos" className="hover:text-primary">Créditos</Link>
          <span>/</span>
          <span className="text-primary font-medium">Simulador</span>
        </div>
        <h1 className="text-[28px] sm:text-[32px] font-bold text-primary tracking-tight">Simulador de crédito</h1>
        <p className="text-[15px] text-on-surface-variant mt-1">
          Calcula tu cuota mensual y cuánto pagarás en total.
        </p>
      </div>

      {error && <Alert type="error" title="No pudimos completar la operación">{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Datos del crédito */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-5 bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-5"
        >
          <div className="space-y-1.5">
            <FormInput
              type="select"
              label="Tipo de crédito"
              name="creditTypeId"
              value={String(product.id)}
              onChange={(e) => handleProductChange(e.target.value)}
              options={products.map((p) => ({ value: String(p.id), label: p.nombre }))}
            />
            <p className="text-[12px] text-gray-500">
              Tasa efectiva anual: <strong className="text-secondary">{formatPercent(product.tasaInstitucion)}</strong>
            </p>
          </div>

          <FormInput
            label="¿Cuánto necesitas?"
            name="amount"
            inputMode="decimal"
            prefix="$"
            value={form.amount}
            onChange={(e) => updateField('amount', e.target.value.replace(',', '.'))}
            onBlur={() => setShowErrors(true)}
            error={fieldError('amount')}
            hint={`Desde ${formatMoneyWhole(product.montoMinimo)} hasta ${formatMoneyWhole(product.montoMaximo)}`}
          />

          <div className="space-y-1.5">
            <span className="block font-title-md text-[13px] text-primary">¿En cuántos meses quieres pagar?</span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {chips.map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => {
                    setCustomTerm(false);
                    updateField('termMonths', String(months));
                  }}
                  className={`py-2 rounded-lg border text-[13px] transition-colors ${
                    !customTerm && termMonthsNumber === months
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
                  customTerm
                    ? 'bg-secondary text-white border-secondary font-semibold'
                    : 'bg-gray-50 text-primary border-gray-200 hover:bg-gray-100'
                }`}
              >
                Otro
              </button>
            </div>
            {customTerm && (
              <FormInput
                name="termMonths"
                inputMode="numeric"
                suffix="meses"
                value={form.termMonths}
                onChange={(e) => updateField('termMonths', e.target.value)}
                onBlur={() => setShowErrors(true)}
                error={fieldError('termMonths')}
                hint={`Entre ${product.plazoMinimo} y ${product.plazoMaximo} meses`}
              />
            )}
            {!customTerm && fieldError('termMonths') && (
              <p className="text-[11px] font-medium text-error">{fieldError('termMonths')}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="block font-title-md text-[13px] text-primary">Tipo de cuota</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SYSTEMS.map((system) => (
                <button
                  key={system.value}
                  type="button"
                  onClick={() => updateField('system', system.value)}
                  className={`p-3 text-left rounded-lg border transition-colors ${
                    form.system === system.value
                      ? 'border-secondary bg-blue-50/60'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className="block text-[14px] font-bold text-primary">{system.title}</span>
                  <span className="block text-[12px] text-gray-500 mt-0.5">{system.detail}</span>
                </button>
              ))}
            </div>
          </div>

          {product.requiereDesgravamen && (
            <p className="text-[12px] text-gray-600 bg-gray-50 rounded-lg p-3">
              Incluye seguro de desgravamen, obligatorio en créditos de vivienda. Puedes contratarlo con la
              aseguradora que elijas.
            </p>
          )}
          {optionalCharges.map((charge) => (
            <label key={charge.id} className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-gray-100">
              <input
                type="checkbox"
                checked={acceptedOptional.includes(charge.id)}
                onChange={() => toggleOptional(charge.id)}
                className="h-4 w-4 mt-0.5 accent-secondary"
              />
              <span className="text-[13px]">
                <strong className="text-primary">Incluir {charge.nombre.toLowerCase()}</strong>
                {charge.categoria === 'SEGURO_DESGRAVAMEN' && (
                  <span className="block text-[12px] text-gray-500">
                    Cubre el saldo de la deuda en caso de fallecimiento o invalidez.
                  </span>
                )}
              </span>
            </label>
          ))}

          <details className="rounded-lg border border-gray-100 px-3 py-2" open={Boolean(fieldError('startDate'))}>
            <summary className="cursor-pointer text-[13px] text-secondary font-medium select-none">
              Opciones avanzadas
            </summary>
            <div className="pt-3">
              <FormInput
                type="date"
                label="Fecha de desembolso"
                name="startDate"
                value={form.startDate}
                min={todayISO()}
                max={addDaysISO(todayISO(), MAX_START_DAYS)}
                onChange={(e) => updateField('startDate', e.target.value)}
                error={fieldError('startDate')}
                hint="La primera cuota vence un mes después."
              />
            </div>
          </details>

          <Button type="submit" variant="fintech" size="lg" className="w-full" loading={submitting} loadingText="Calculando...">
            Simular
          </Button>
        </form>

        {/* Resultado */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
          {!simulation ? (
            <div className="py-10 text-center space-y-2">
              <span className="material-symbols-outlined text-[40px] text-secondary">calculate</span>
              <p className="text-[15px] font-semibold text-primary">Tu resultado aparecerá aquí</p>
              <p className="text-[13px] text-gray-500">Completa los datos y pulsa «Simular».</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className={isStale ? 'opacity-60' : ''}>
                <CreditSummary simulation={simulation} rows={rows} tasaMaximaBCE={productInfo?.tasaMaximaBCE} />
              </div>

              {isStale && <Alert type="warning">Cambiaste los datos. Pulsa «Simular» para actualizar el resultado.</Alert>}

              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                {(!isAuthenticated || isClient) && (
                  <Button variant="fintech" iconName="send" onClick={handleApply} disabled={isStale} className="sm:flex-1">
                    Solicitar este crédito
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
              <div className="flex flex-wrap gap-4 text-[13px]">
                <button type="button" className="text-secondary font-medium hover:underline" onClick={() => setShowTable((v) => !v)}>
                  {showTable ? 'Ocultar tabla de amortización' : 'Ver tabla de amortización'}
                </button>
                <button type="button" className="text-secondary font-medium hover:underline" onClick={handleCompare}>
                  Comparar cuota fija y decreciente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {simulation && showTable && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-3">
          <h2 className="text-[17px] font-bold text-primary">Tabla de amortización</h2>
          <AmortizationTable rows={rows} simulation={simulation} />
          <p className="text-[12px] text-gray-500">
            Valores referenciales calculados con base comercial de 360 días. Las condiciones finales se
            confirman al aprobar el crédito.
          </p>
        </div>
      )}

      <Modal
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        title="Cuota fija vs. cuota decreciente"
        maxWidth="max-w-2xl"
      >
        {comparing || !comparison ? (
          <LoadingState message="Calculando ambos sistemas..." />
        ) : (
          <div className="space-y-4">
            <p className="text-[14px] text-gray-600">
              {formatMoney(form.amount)} a {form.termMonths} meses con {comparison.product.nombre}.
            </p>
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 font-medium">Concepto</th>
                  <th className="py-2 font-medium text-right">Cuota fija</th>
                  <th className="py-2 font-medium text-right">Cuota decreciente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['Primera cuota', 'primeraCuota'],
                  ['Última cuota', 'ultimaCuota'],
                  ['Total de intereses', 'totalIntereses'],
                  ['Total a pagar en cuotas', 'totalPagar'],
                ].map(([label, key]) => (
                  <tr key={key}>
                    <td className="py-2.5 text-gray-700">{label}</td>
                    <td className="py-2.5 text-right text-primary font-numeric-data">{formatMoney(comparison.frances[key])}</td>
                    <td className="py-2.5 text-right text-primary font-numeric-data">{formatMoney(comparison.aleman[key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[13px] text-gray-600">
              Con cuota decreciente pagas{' '}
              <strong className="text-primary">
                {formatMoney(comparison.frances.totalIntereses - comparison.aleman.totalIntereses)}
              </strong>{' '}
              menos de intereses, pero tus primeras cuotas son más altas.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowComparison(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
