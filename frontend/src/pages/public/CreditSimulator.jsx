import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { publicService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { LoadingState } from '../../components/Spinner';
import Alert from '../../components/Alert';

export default function CreditSimulator() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  // Products and status
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [creditTypeId, setCreditTypeId] = useState(searchParams.get('creditTypeId') || '');
  const [amount, setAmount] = useState(Number(searchParams.get('monto')) || 10000);
  const [termMonths, setTermMonths] = useState(Number(searchParams.get('plazo')) || 24);
  const [termUnit, setTermUnit] = useState('MESES'); // 'MESES' | 'ANIOS'
  const [amortizationSystem, setAmortizationSystem] = useState('FRANCES');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const todayISO = new Date().toISOString().split('T')[0];

  // Simulation Result State
  const [simulation, setSimulation] = useState(null);
  const [rows, setRows] = useState([]);

  // Comparison State
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);

  // Selected Product details
  const selectedProduct = products.find((p) => String(p.id) === String(creditTypeId)) || products[0];

  const minMonths = selectedProduct?.plazoMinimo || 6;
  const maxMonths = selectedProduct?.plazoMaximo || 72;
  const canSwitchToYears = maxMonths > 24;

  // Dynamic quick chips based on min/max of product
  const dynamicChips = useMemo(() => {
    if (!maxMonths) return [12, 24, 36, 48];
    if (maxMonths <= 24) {
      return [6, 12, 18, 24].filter((m) => m >= minMonths && m <= maxMonths);
    }
    if (maxMonths <= 72) {
      return [12, 24, 36, 48, 60, 72].filter((m) => m >= minMonths && m <= maxMonths);
    }
    // High terms like Mortgage (vivienda)
    return [36, 60, 120, 180, 240, 300].filter((m) => m >= minMonths && m <= maxMonths);
  }, [minMonths, maxMonths]);

  const formatUSD = (val) => {
    if (val === undefined || val === null) return '$ 0.00';
    return '$ ' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 1. Load initial credit products
  useEffect(() => {
    publicService
      .getCreditProducts()
      .then((res) => {
        if (res.success && res.data?.products?.length > 0) {
          const prods = res.data.products;
          setProducts(prods);

          const defaultId = searchParams.get('creditTypeId') || String(prods[0].id);
          setCreditTypeId(defaultId);

          if (!routeId) {
            executeSimulation({
              creditTypeId: parseInt(defaultId, 10),
              amount,
              termMonths,
              amortizationSystem,
              startDate,
            });
          }
        }
      })
      .catch((err) => {
        setError(err.message || 'Error al conectar con el servidor.');
      })
      .finally(() => setLoadingProducts(false));
  }, []);

  // 2. Load saved simulation if routeId
  useEffect(() => {
    if (routeId) {
      setCalculating(true);
      publicService
        .getCreditSimulation(routeId)
        .then((res) => {
          if (res.success && res.data?.simulation) {
            const sim = res.data.simulation;
            setSimulation(sim);
            setRows(sim.rows || []);
            setCreditTypeId(String(sim.creditTypeId));
            setAmount(Number(sim.monto));
            setTermMonths(Number(sim.plazoMeses));
            setAmortizationSystem(sim.sistemaAmortizacion);
            if (sim.fechaInicio) setStartDate(sim.fechaInicio);
          }
        })
        .catch((err) => {
          setError(err.message || 'Error al cargar la simulación guardada.');
        })
        .finally(() => setCalculating(false));
    }
  }, [routeId]);

  const executeSimulation = async (params) => {
    setCalculating(true);
    setError(null);
    try {
      const payload = params || {
        creditTypeId: parseInt(creditTypeId, 10),
        amount: parseFloat(amount),
        termMonths: parseInt(termMonths, 10),
        amortizationSystem,
        startDate,
      };

      const response = await publicService.simulateCredit(payload);
      if (response.success && response.data?.simulation) {
        setSimulation(response.data.simulation);
        setRows(response.data.rows || response.data.simulation.rows || []);
      }
    } catch (err) {
      setError(err.message || 'No se pudo completar la simulación.');
    } finally {
      setCalculating(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    executeSimulation();
  };

  const handleCompareSystems = async () => {
    setShowComparisonModal(true);
    setComparing(true);
    try {
      const payloadFrench = {
        creditTypeId: parseInt(creditTypeId, 10),
        amount: parseFloat(amount),
        termMonths: parseInt(termMonths, 10),
        amortizationSystem: 'FRANCES',
        startDate,
      };

      const payloadGerman = {
        creditTypeId: parseInt(creditTypeId, 10),
        amount: parseFloat(amount),
        termMonths: parseInt(termMonths, 10),
        amortizationSystem: 'ALEMAN',
        startDate,
      };

      const [resFrench, resGerman] = await Promise.all([
        publicService.simulateCredit(payloadFrench),
        publicService.simulateCredit(payloadGerman),
      ]);

      if (resFrench.success && resGerman.success) {
        setComparisonData({
          french: resFrench.data.simulation,
          frenchRows: resFrench.data.rows || resFrench.data.simulation.rows || [],
          german: resGerman.data.simulation,
          germanRows: resGerman.data.rows || resGerman.data.simulation.rows || [],
        });
      }
    } catch (err) {
      setError('Error al comparar los dos sistemas de amortización.');
    } finally {
      setComparing(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!simulation?.id) return;
    setDownloadingPdf(true);
    const pdfUrl = publicService.getCreditSimulationPdfUrl(simulation.id);
    window.open(pdfUrl, '_blank');
    setTimeout(() => setDownloadingPdf(false), 2000);
  };

  const handleApply = () => {
    if (!simulation?.id) return;
    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: `/cliente/solicitudes?simulationId=${simulation.id}`,
          message: 'Inicia sesión para registrar tu solicitud de crédito.',
        },
      });
    } else {
      navigate(`/cliente/solicitudes?simulationId=${simulation.id}`);
    }
  };

  if (loadingProducts) {
    return <LoadingState message="Cargando simulador de crédito..." />;
  }

  const activeRate = selectedProduct
    ? Number(selectedProduct.tasaInstitucion).toFixed(2)
    : '15.20';
  const legalCap = selectedProduct?.segment?.tasaMaxima
    ? Number(selectedProduct.segment.tasaMaxima).toFixed(2)
    : '16.77';

  // Chart data
  const chartData = rows.map((r) => ({
    cuota: `${r.numeroCuota}`,
    capital: Number(r.capital),
    interes: Number(r.interes),
    total: Number(r.totalPago),
  }));

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 md:py-10 space-y-8">
      {/* Cabecera */}
      <div className="pb-4 border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-2">
          <Link to="/" className="hover:text-primary transition-colors">
            Inicio
          </Link>
          <span>/</span>
          <Link to="/creditos" className="hover:text-primary transition-colors">
            Créditos
          </Link>
          <span>/</span>
          <span className="text-primary font-medium">Simulador</span>
        </div>
        <h1 className="text-[28px] sm:text-[34px] font-bold text-primary tracking-tight">
          Simulador de crédito
        </h1>
        <p className="text-[15px] text-on-surface-variant mt-1">
          Configura tu financiamiento y consulta la cuota estimada junto a la tabla de pagos completa.
        </p>
      </div>

      {error && <Alert type="error" title="Atención">{error}</Alert>}

      {/* Grid Principal: Formulario (5 cols), Resultados (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Formulario de Parámetros */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-secondary">tune</span>
              <h2 className="text-[17px] font-bold text-primary">
                Parámetros del crédito
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setAmount(10000);
                setTermMonths(24);
                setTermUnit('MESES');
                setAmortizationSystem('FRANCES');
              }}
              className="text-[13px] text-secondary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              <span>Restaurar</span>
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* 1. Selector de Producto */}
            <div>
              <label className="block text-[14px] font-medium text-primary mb-1.5" htmlFor="credit-type">
                Tipo de crédito
              </label>
              <div className="relative">
                <select
                  id="credit-type"
                  value={creditTypeId}
                  onChange={(e) => setCreditTypeId(e.target.value)}
                  className="w-full h-11 px-3.5 pr-10 bg-gray-50/50 hover:bg-gray-50 text-primary text-[14px] font-medium rounded-lg border border-gray-200 focus:outline-none focus:bg-white focus:border-secondary transition-colors cursor-pointer appearance-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({Number(p.tasaInstitucion).toFixed(2)}% anual)
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[20px]">
                  expand_more
                </span>
              </div>
              <div className="flex justify-between items-center text-[12px] text-gray-500 mt-1.5">
                <span>Tasa anual: <strong className="text-secondary">{activeRate}%</strong></span>
                <span>Techo máx. BCE: {legalCap}%</span>
              </div>
            </div>

            {/* 2. Monto a Financiar */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[14px] font-medium text-primary flex items-center gap-1" htmlFor="input-amount">
                  <span className="material-symbols-outlined text-[16px] text-secondary">payments</span>
                  <span>Monto a financiar</span>
                </label>
                <span className="text-[12px] text-gray-500">
                  {formatUSD(selectedProduct?.montoMinimo || 500)} – {formatUSD(selectedProduct?.montoMaximo || 50000)}
                </span>
              </div>
              <div className="relative flex items-center mb-2">
                <span className="absolute left-3.5 text-gray-400 text-[16px] font-medium select-none">$</span>
                <input
                  id="input-amount"
                  type="number"
                  min={selectedProduct?.montoMinimo || 500}
                  max={selectedProduct?.montoMaximo || 50000}
                  step="100"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full h-11 pl-8 pr-4 bg-gray-50/50 text-primary text-[16px] font-bold rounded-lg border border-gray-200 focus:outline-none focus:bg-white focus:border-secondary transition-colors font-numeric-data"
                />
              </div>
              <input
                type="range"
                min={selectedProduct?.montoMinimo || 500}
                max={selectedProduct?.montoMaximo || 50000}
                step="500"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-secondary"
              />
            </div>

            {/* 3. Plazo de Financiamiento DINÁMICO (Meses o Años) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[14px] font-medium text-primary flex items-center gap-1" htmlFor="input-term">
                  <span className="material-symbols-outlined text-[16px] text-secondary">calendar_month</span>
                  <span>Plazo de pago</span>
                  {termMonths >= 24 && (
                    <span className="text-[12px] text-secondary font-semibold ml-1">
                      ({(termMonths / 12).toFixed(termMonths % 12 === 0 ? 0 : 1)} {termMonths === 12 ? 'año' : 'años'})
                    </span>
                  )}
                </label>
                <span className="text-[12px] text-gray-500">
                  Rango: {minMonths} a {maxMonths} meses
                </span>
              </div>

              {/* Input y Selector Dinámico Meses / Años */}
              <div className="grid grid-cols-12 gap-2 mb-2">
                <input
                  id="input-term"
                  type="number"
                  min={termUnit === 'ANIOS' ? Math.max(1, Math.round(minMonths / 12)) : minMonths}
                  max={termUnit === 'ANIOS' ? Math.round(maxMonths / 12) : maxMonths}
                  step={termUnit === 'ANIOS' ? '0.5' : '1'}
                  value={termUnit === 'ANIOS' ? Number((termMonths / 12).toFixed(1)) : termMonths}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (termUnit === 'ANIOS') {
                      setTermMonths(Math.max(minMonths, Math.min(maxMonths, Math.round(val * 12))));
                    } else {
                      setTermMonths(Math.max(minMonths, Math.min(maxMonths, val)));
                    }
                  }}
                  className="col-span-7 h-11 px-3.5 bg-gray-50/50 text-primary text-[16px] font-bold rounded-lg border border-gray-200 focus:outline-none focus:bg-white focus:border-secondary transition-colors font-numeric-data"
                />

                {/* Unidad Toggle: Meses o Años (cuando plazo > 24) */}
                <div className="col-span-5 h-11 bg-gray-100 rounded-lg p-1 flex items-center border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setTermUnit('MESES')}
                    className={`flex-1 h-full rounded text-[12px] font-semibold transition-all ${
                      termUnit === 'MESES'
                        ? 'bg-white text-secondary shadow-xs'
                        : 'text-gray-500 hover:text-primary'
                    }`}
                  >
                    Meses
                  </button>
                  {canSwitchToYears ? (
                    <button
                      type="button"
                      onClick={() => setTermUnit('ANIOS')}
                      className={`flex-1 h-full rounded text-[12px] font-semibold transition-all ${
                        termUnit === 'ANIOS'
                          ? 'bg-white text-secondary shadow-xs'
                          : 'text-gray-500 hover:text-primary'
                      }`}
                    >
                      Años
                    </button>
                  ) : (
                    <span className="flex-1 text-center text-[11px] text-gray-400 select-none">
                      (≤24m)
                    </span>
                  )}
                </div>
              </div>

              {/* Chips rápidos de plazo generados dinámicamente según el producto */}
              <div className="flex flex-wrap gap-2">
                {dynamicChips.map((m) => {
                  const years = m / 12;
                  const isYearExact = m % 12 === 0;
                  const label =
                    m >= 24
                      ? `${m}m (${isYearExact ? years : years.toFixed(1)} ${years === 1 ? 'año' : 'años'})`
                      : `${m} meses`;

                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTermMonths(m)}
                      className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                        termMonths === m
                          ? 'bg-secondary text-white font-semibold'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Sistema de Amortización */}
            <div>
              <label className="block text-[14px] font-medium text-primary mb-2">
                Sistema de amortización
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAmortizationSystem('FRANCES')}
                  className={`p-3 text-left rounded-lg border transition-all ${
                    amortizationSystem === 'FRANCES'
                      ? 'border-secondary bg-blue-50/50 shadow-xs'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-[14px] font-bold text-primary">Francés</div>
                  <div className="text-[12px] text-gray-500 mt-0.5">Cuotas fijas mensuales</div>
                </button>

                <button
                  type="button"
                  onClick={() => setAmortizationSystem('ALEMAN')}
                  className={`p-3 text-left rounded-lg border transition-all ${
                    amortizationSystem === 'ALEMAN'
                      ? 'border-secondary bg-blue-50/50 shadow-xs'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-[14px] font-bold text-primary">Alemán</div>
                  <div className="text-[12px] text-gray-500 mt-0.5">Cuotas decrecientes</div>
                </button>
              </div>
            </div>

            {/* 5. Fecha Primer Pago */}
            <div>
              <label className="block text-[13px] font-medium text-primary mb-1" htmlFor="start-date">
                Fecha del primer pago
              </label>
              <input
                id="start-date"
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
                loading={calculating}
                loadingText="Calculando..."
                className="w-full"
                iconName="calculate"
              >
                Actualizar simulación
              </Button>
            </div>
          </form>
        </div>

        {/* Panel de Resultados Financieros */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tarjeta de Resumen Financiero Hero */}
          <div className="bg-primary text-white p-7 rounded-xl shadow-sm space-y-6 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[13px] font-medium text-blue-200 block">
                  {simulation?.sistemaAmortizacion === 'ALEMAN'
                    ? 'Cuota inicial estimada (Decreciente)'
                    : 'Cuota mensual estimada'}
                </span>
                <div className="text-[38px] sm:text-[44px] font-bold tracking-tight mt-1 font-numeric-hero">
                  {formatUSD(simulation?.cuotaInicial || 0)}
                </div>
                <p className="text-[13px] text-blue-200/80 mt-1">
                  {simulation?.sistemaAmortizacion === 'ALEMAN'
                    ? 'Capital constante. Los intereses se reducen cada mes.'
                    : 'Cuota fija durante todo el plazo.'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-blue-200">
                <span className="material-symbols-outlined text-[28px]">payments</span>
              </div>
            </div>

            {/* Desglose de Totales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-white/10 text-[13px]">
              <div>
                <span className="text-blue-200/80 block">Monto</span>
                <span className="text-[16px] font-bold text-white font-numeric-data mt-0.5 block">
                  {formatUSD(simulation?.monto || amount)}
                </span>
              </div>
              <div>
                <span className="text-blue-200/80 block">Intereses</span>
                <span className="text-[16px] font-bold text-emerald-300 font-numeric-data mt-0.5 block">
                  {formatUSD(simulation?.totalIntereses || 0)}
                </span>
              </div>
              <div>
                <span className="text-blue-200/80 block">Cargos y SOLCA</span>
                <span className="text-[16px] font-bold text-white font-numeric-data mt-0.5 block">
                  {formatUSD(simulation?.totalCargos || 0)}
                </span>
              </div>
              <div>
                <span className="text-blue-200/80 block">Total a pagar</span>
                <span className="text-[16px] font-bold text-white font-numeric-data mt-0.5 block">
                  {formatUSD(simulation?.totalPagar || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Acciones de la Simulación */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Button
              type="button"
              variant="fintech"
              onClick={handleApply}
              className="w-full sm:w-auto"
              iconName="send"
            >
              Solicitar este crédito
            </Button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCompareSystems}
                size="md"
                iconName="compare_arrows"
              >
                Comparar sistemas
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || !simulation?.id}
                size="md"
                iconName="download"
              >
                {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
              </Button>
            </div>
          </div>

          {/* Gráfico de Evolución: Capital vs Intereses */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-secondary">bar_chart</span>
                  <h3 className="text-[16px] font-bold text-primary">
                    Evolución: Capital vs Intereses
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-[13px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-primary inline-block"></span>
                    <span className="text-gray-600 font-medium">Capital</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-secondary inline-block"></span>
                    <span className="text-gray-600 font-medium">Interés</span>
                  </div>
                </div>
              </div>

              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="cuota"
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatUSD(value),
                        name === 'capital' ? 'Capital amortizado' : 'Interés',
                      ]}
                      labelFormatter={(label) => `Cuota ${label}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                    />
                    <Bar dataKey="capital" fill="#001026" stackId="a" />
                    <Bar dataKey="interes" fill="#0050cc" stackId="a" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de Amortización con ENCABEZADO AZUL Y ELEGANTE */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-secondary">table_view</span>
            <div>
              <h3 className="text-[18px] font-bold text-primary">
                Tabla de amortización
              </h3>
              <p className="text-[13px] text-gray-500 mt-0.5">
                Desglose mensual cuota a cuota.
              </p>
            </div>
          </div>
          <span className="text-[13px] font-semibold text-secondary px-3 py-1 bg-blue-50 rounded-full border border-blue-100 self-start sm:self-auto">
            {simulation?.plazoMeses || termMonths} cuotas programadas
          </span>
        </div>

        {/* Tabla con encabezado azul corporativo */}
        <div className="overflow-x-auto rounded-lg border border-primary/20 shadow-xs">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#0b2545] text-white font-semibold">
              <tr>
                <th className="py-3.5 px-4 text-center text-blue-100 font-semibold">N°</th>
                <th className="py-3.5 px-4 text-blue-100 font-semibold">Fecha</th>
                <th className="py-3.5 px-4 text-right text-blue-100 font-semibold">Saldo Inicial</th>
                <th className="py-3.5 px-4 text-right text-blue-100 font-semibold">Capital</th>
                <th className="py-3.5 px-4 text-right text-blue-100 font-semibold">Interés</th>
                <th className="py-3.5 px-4 text-right text-blue-100 font-semibold">Cargos / SOLCA</th>
                <th className="py-3.5 px-4 text-right text-white font-bold bg-[#001026]">Cuota Total</th>
                <th className="py-3.5 px-4 text-right text-blue-100 font-semibold">Saldo Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-numeric-data">
              {rows.map((r) => (
                <tr key={r.numeroCuota} className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-2.5 px-4 text-center font-medium text-gray-600">{r.numeroCuota}</td>
                  <td className="py-2.5 px-4 text-gray-600">{r.fechaPago}</td>
                  <td className="py-2.5 px-4 text-right">{formatUSD(r.saldoInicial)}</td>
                  <td className="py-2.5 px-4 text-right text-primary font-medium">{formatUSD(r.capital)}</td>
                  <td className="py-2.5 px-4 text-right text-secondary font-medium">{formatUSD(r.interes)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-500">{formatUSD(r.cargos)}</td>
                  <td className="py-2.5 px-4 text-right text-primary font-bold bg-blue-50/20">{formatUSD(r.totalPago)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-600">{formatUSD(r.saldoFinal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#e6eeff] font-bold font-numeric-data border-t-2 border-primary/30 text-primary">
              <tr>
                <td className="py-3.5 px-4 text-left" colSpan={3}>
                  Totales acumulados
                </td>
                <td className="py-3.5 px-4 text-right">{formatUSD(simulation?.monto || amount)}</td>
                <td className="py-3.5 px-4 text-right text-emerald-800">{formatUSD(simulation?.totalIntereses || 0)}</td>
                <td className="py-3.5 px-4 text-right text-gray-700">{formatUSD(simulation?.totalCargos || 0)}</td>
                <td className="py-3.5 px-4 text-right text-primary text-[14px] bg-[#d5e3fd]">{formatUSD(simulation?.totalPagar || 0)}</td>
                <td className="py-3.5 px-4 text-right">$ 0.00</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-[12px] text-gray-500 pt-1">
          Nota: Las cuotas calculadas son referenciales según la metodología legal vigente del Ecuador (base 360 días).
        </p>
      </div>

      {/* Modal de Comparación con ENCABEZADO AZUL */}
      <Modal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        title="Comparación: Sistema Francés vs Sistema Alemán"
        maxWidth="max-w-3xl"
      >
        {comparing ? (
          <LoadingState message="Calculando simulación en ambos sistemas..." />
        ) : comparisonData ? (
          <div className="space-y-6">
            <p className="text-[14px] text-gray-600">
              Comparación directa para <strong>{formatUSD(amount)}</strong> a <strong>{termMonths} meses</strong> al <strong>{activeRate}% anual</strong>:
            </p>

            <div className="overflow-x-auto rounded-lg border border-primary/20 shadow-xs">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-[#0b2545] text-white font-semibold">
                  <tr>
                    <th className="py-3.5 px-4 text-white">Concepto</th>
                    <th className="py-3.5 px-4 text-right text-blue-200">Sistema Francés</th>
                    <th className="py-3.5 px-4 text-right text-emerald-300">Sistema Alemán</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-numeric-data">
                  <tr>
                    <td className="py-2.5 px-4 text-gray-700">Cuota inicial:</td>
                    <td className="py-2.5 px-4 text-right font-bold text-secondary">
                      {formatUSD(comparisonData.french?.cuotaInicial)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-800">
                      {formatUSD(comparisonData.german?.cuotaInicial)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-gray-700">Cuota final estimada:</td>
                    <td className="py-2.5 px-4 text-right font-bold text-secondary">
                      {formatUSD(comparisonData.frenchRows[comparisonData.frenchRows.length - 1]?.totalPago)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-800">
                      {formatUSD(comparisonData.germanRows[comparisonData.germanRows.length - 1]?.totalPago)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-gray-700">Total intereses pagados:</td>
                    <td className="py-2.5 px-4 text-right font-bold text-secondary">
                      {formatUSD(comparisonData.french?.totalIntereses)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-800">
                      {formatUSD(comparisonData.german?.totalIntereses)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-gray-700">Cargos y SOLCA:</td>
                    <td className="py-2.5 px-4 text-right text-gray-600">
                      {formatUSD(comparisonData.french?.totalCargos)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-600">
                      {formatUSD(comparisonData.german?.totalCargos)}
                    </td>
                  </tr>
                  <tr className="bg-[#e6eeff] font-bold">
                    <td className="py-3.5 px-4 text-primary">Total desembolsado:</td>
                    <td className="py-3.5 px-4 text-right text-primary text-[15px]">
                      {formatUSD(comparisonData.french?.totalPagar)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-900 text-[15px]">
                      {formatUSD(comparisonData.german?.totalPagar)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 text-blue-900">
                <strong className="block mb-1 font-semibold">Sistema Francés:</strong>
                Cuotas fijas mensuales durante todo el periodo. Mayor facilidad para presupuestar pagos mensuales constantes.
              </div>
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-900">
                <strong className="block mb-1 font-semibold">Sistema Alemán:</strong>
                Cuotas decrecientes mes a mes. Amortiza capital más rápido y resulta en un costo financiero total menor.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowComparisonModal(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
