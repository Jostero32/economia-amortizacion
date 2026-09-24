import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { publicService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';

export default function InvestmentSimulator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState(searchParams.get('productId') || '');
  const [amount, setAmount] = useState(15000);
  const [termDays, setTermDays] = useState(360);
  const [customDays, setCustomDays] = useState(false);
  const [paymentFrequency, setPaymentFrequency] = useState('maturity');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Simulation Result State
  const [simulation, setSimulation] = useState(null);
  const todayISO = new Date().toISOString().split('T')[0];

  const selectedProduct =
    products.find((p) => String(p.id) === String(selectedProductId)) || products[0];

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0);
  const simulationGain = Number(simulation?.interesGanado ?? simulation?.rendimiento ?? 0);

  // 1. Load investment products
  useEffect(() => {
    publicService
      .getInvestmentProducts()
      .then((res) => {
        if (res.success && res.data?.products?.length > 0) {
          const prods = res.data.products;
          setProducts(prods);
          const defaultId = searchParams.get('productId') || String(prods[0].id);
          setSelectedProductId(defaultId);

          executeSimulation({
            investmentProductId: parseInt(defaultId, 10),
            amount: 15000,
            termDays: 360,
            startDate: new Date().toISOString().split('T')[0],
          });
        }
      })
      .catch((err) => {
        setError(err.message || 'Error al cargar productos de inversión');
      })
      .finally(() => setLoading(false));
  }, []);

  const executeSimulation = async (params) => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = params || {
        investmentProductId: parseInt(selectedProductId, 10),
        amount: parseFloat(amount),
        termDays: parseInt(termDays, 10),
        startDate,
      };

      const response = await publicService.simulateInvestment(payload);
      if (response.success && response.data?.simulation) {
        setSimulation(response.data.simulation);
      }
    } catch (err) {
      setError(err.message || 'No se pudo completar la simulación de inversión.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    executeSimulation();
  };

  const handleApply = () => {
    if (!simulation?.id) return;
    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: `/cliente/solicitudes?investmentSimulationId=${simulation.id}`,
          message: 'Inicia sesión para registrar tu solicitud de inversión a plazo.',
        },
      });
    } else {
      navigate(`/cliente/solicitudes?investmentSimulationId=${simulation.id}`);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando simulador de depósitos a plazo (DPF)..." />;
  }

  const isExceedingCosede = amount > 32000;
  const isSriExempt = termDays >= 180;
  const monthlyAvgYield = simulation && termDays > 0 ? simulationGain / (termDays / 30) : 0;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 md:py-10 space-y-8">
      {/* Cabecera Limpia */}
      <div className="pb-4 border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-2">
          <Link to="/" className="hover:text-primary transition-colors">
            Inicio
          </Link>
          <span>/</span>
          <Link to="/inversiones" className="hover:text-primary transition-colors">
            Inversiones
          </Link>
          <span>/</span>
          <span className="text-primary font-medium">Simulador</span>
        </div>
        <h1 className="text-[28px] sm:text-[34px] font-bold text-primary tracking-tight">
          Simulador de inversiones (DPF)
        </h1>
        <p className="text-[15px] text-on-surface-variant mt-1">
          Proyecta los rendimientos de tu capital a plazo fijo con tasas del Banco Central del Ecuador.
        </p>
      </div>

      {error && <Alert type="error" title="Error">{error}</Alert>}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Panel Izquierdo: Parámetros */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-secondary">tune</span>
              <h2 className="text-[17px] font-bold text-primary">
                Parámetros del depósito
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setAmount(15000);
                setTermDays(360);
                setCustomDays(false);
              }}
              className="text-[13px] text-secondary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              <span>Restaurar</span>
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* 1. Instrumento */}
            <div>
              <label className="block text-[14px] font-medium text-primary mb-1.5" htmlFor="investment-type">
                Producto de inversión
              </label>
              <div className="relative">
                <select
                  id="investment-type"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full h-11 px-3.5 pr-10 bg-gray-50/50 hover:bg-gray-50 text-primary text-[14px] font-medium rounded-lg border border-gray-200 focus:outline-none focus:bg-white focus:border-secondary transition-colors cursor-pointer appearance-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[20px]">
                  expand_more
                </span>
              </div>
              <span className="text-[12px] text-gray-500 mt-1 block">
                Renta fija • Tasa pactada no sujeta a variaciones de mercado
              </span>
            </div>

            {/* 2. Monto a Invertir */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[14px] font-medium text-primary flex items-center gap-1.5" htmlFor="amount-input">
                  <span className="material-symbols-outlined text-[16px] text-secondary">payments</span>
                  <span>Monto a invertir (USD)</span>
                </label>
                {isExceedingCosede && (
                  <span className="text-[12px] text-amber-700 font-medium">
                    Excede seguro COSEDE ($32.000)
                  </span>
                )}
              </div>
              <div className="relative flex items-center mb-2">
                <span className="absolute left-3.5 text-gray-400 text-[16px] font-medium select-none">$</span>
                <input
                  id="amount-input"
                  type="number"
                  min={selectedProduct?.montoMinimo || 500}
                  step="500"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full h-11 pl-8 pr-4 bg-gray-50/50 text-primary text-[16px] font-bold rounded-lg border border-gray-200 focus:outline-none focus:bg-white focus:border-secondary transition-colors font-numeric-data"
                />
              </div>

              {/* Botones de montos sugeridos */}
              <div className="flex flex-wrap gap-2">
                {[1000, 5000, 10000, 15000, 25000, 50000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    className={`px-3 py-1 text-[13px] rounded-md transition-colors ${
                      amount === val
                        ? 'bg-secondary text-white font-semibold'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ${val >= 1000 ? `${val / 1000}k` : val}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Plazo de la Inversión */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[14px] font-medium text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-secondary">calendar_month</span>
                  <span>Plazo de la inversión</span>
                </label>
                <span className="text-[13px] font-bold text-secondary">
                  {termDays} días ({Math.round(termDays / 30)} meses)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { days: 90, label: '90 días' },
                  { days: 180, label: '180 días' },
                  { days: 360, label: '360 días' },
                  { days: 540, label: '540 días' },
                  { days: 720, label: '720 días' },
                ].map((t) => (
                  <button
                    key={t.days}
                    type="button"
                    onClick={() => {
                      setTermDays(t.days);
                      setCustomDays(false);
                    }}
                    className={`p-2.5 rounded-lg text-center transition-all border text-[13px] ${
                      termDays === t.days && !customDays
                        ? 'bg-secondary text-white font-semibold border-secondary'
                        : 'bg-gray-50 hover:bg-gray-100 text-primary border-gray-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCustomDays(true)}
                  className={`p-2.5 rounded-lg text-center transition-all border text-[13px] ${
                    customDays
                      ? 'bg-secondary text-white font-semibold border-secondary'
                      : 'bg-gray-50 hover:bg-gray-100 text-primary border-gray-200'
                  }`}
                >
                  Personalizado
                </button>
              </div>

              {customDays && (
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="30"
                    max="1800"
                    value={termDays}
                    onChange={(e) => setTermDays(Number(e.target.value))}
                    className="w-28 h-10 px-3 rounded-lg bg-gray-50 text-primary font-bold border border-gray-200 focus:outline-none focus:bg-white text-[14px]"
                  />
                  <span className="text-[13px] text-gray-500">
                    Días calendario (mínimo legal: 30)
                  </span>
                </div>
              )}
            </div>

            {/* 4. Fecha de Inicio */}
            <div>
              <label className="block text-[13px] font-medium text-primary mb-1" htmlFor="inv-start-date">
                Fecha de apertura
              </label>
              <input
                id="inv-start-date"
                type="date"
                min={todayISO}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50/50 text-primary text-[13px] rounded-lg border border-gray-200 focus:outline-none focus:bg-white focus:border-secondary transition-colors"
              />
            </div>

            {/* Botón de Envío */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="fintech"
                size="lg"
                loading={submitting}
                loadingText="Calculando..."
                className="w-full"
              >
                Actualizar simulación
              </Button>
            </div>
          </form>
        </div>

        {/* Panel Derecho: Resultados */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tarjeta de Resumen Hero */}
          <div className="bg-primary text-white p-7 rounded-xl shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <span className="text-[13px] font-medium text-blue-200 block">
                  Ganancia neta estimada
                </span>
                <div className="text-[38px] sm:text-[44px] font-bold tracking-tight text-emerald-300 mt-1 font-numeric-hero">
                  +{formatUSD(simulationGain)}
                </div>
                <p className="text-[13px] text-blue-200/80 mt-1">
                  Rendimiento mensual promedio: {formatUSD(monthlyAvgYield)}/mes
                </p>
              </div>

              <div className="sm:text-right bg-white/10 p-3.5 rounded-lg border border-white/10">
                <span className="text-[12px] text-blue-200 block">Tasa de rendimiento</span>
                <span className="text-[24px] font-bold text-white font-numeric-data">
                  {simulation ? Number(simulation.tasaAnual).toFixed(2) : '8.15'}%
                </span>
                <span className="text-[12px] text-blue-200 block">TEA Anual</span>
              </div>
            </div>

            {/* Desglose de Totales */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-5 border-t border-white/10 text-[13px]">
              <div>
                <span className="text-blue-200/80 block">Capital invertido</span>
                <span className="text-[17px] font-bold text-white font-numeric-data mt-0.5 block">
                  {formatUSD(amount)}
                </span>
              </div>
              <div>
                <span className="text-blue-200/80 block">Plazo de colocación</span>
                <span className="text-[17px] font-bold text-white font-numeric-data mt-0.5 block">
                  {termDays} días
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-blue-200/80 block">Total al vencimiento</span>
                <span className="text-[18px] font-extrabold text-white font-numeric-data mt-0.5 block">
                  {formatUSD(simulation?.valorFinal || amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Información Regulatoria y Fiscal Concisa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
              <div className="text-[14px] font-bold text-primary mb-1">
                {isSriExempt ? 'Exento de retención SRI (0%)' : 'Aplica retención SRI'}
              </div>
              <p className="text-[13px] text-gray-500">
                {isSriExempt
                  ? 'Exento por disposición legal al mantenerse a plazos iguales o mayores a 180 días.'
                  : 'Aplica retención del 2% al liquidarse en plazos inferiores a 180 días.'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
              <div className="text-[14px] font-bold text-primary mb-1">
                {isExceedingCosede ? 'Cobertura COSEDE hasta $32k' : '100% Protegido por COSEDE'}
              </div>
              <p className="text-[13px] text-gray-500">
                Amparado por el seguro de depósitos oficial de las instituciones financieras del Ecuador.
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Button
              type="button"
              variant="fintech"
              onClick={handleApply}
              className="w-full sm:w-auto"
            >
              Solicitar esta inversión →
            </Button>

            <Link to="/inversiones" className="w-full sm:w-auto text-center">
              <Button variant="outline" className="w-full sm:w-auto">
                Ver otros productos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
