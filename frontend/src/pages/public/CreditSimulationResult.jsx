import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { publicService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import { LoadingState } from '../../components/Spinner';

export default function CreditSimulationResult() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [simulation, setSimulation] = useState(location.state?.simulationData?.simulation || null);
  const [rows, setRows] = useState(location.state?.simulationData?.rows || []);
  const [loading, setLoading] = useState(!simulation);
  const [error, setError] = useState(null);

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0);

  useEffect(() => {
    if (!simulation) {
      publicService
        .getCreditSimulation(id)
        .then((res) => {
          if (res.success && res.data?.simulation) {
            setSimulation(res.data.simulation);
            setRows(res.data.simulation.rows || []);
          }
        })
        .catch((err) => {
          setError(err.message || 'Error al cargar la simulación de crédito');
        })
        .finally(() => setLoading(false));
    }
  }, [id, simulation]);

  const handleApply = () => {
    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: `/cliente/solicitudes?simulationId=${id}`,
          message: 'Inicia sesión para continuar con la solicitud de crédito.',
        },
      });
    } else {
      navigate(`/cliente/solicitudes?simulationId=${id}`);
    }
  };

  const handleDownloadPdf = () => {
    const pdfUrl = publicService.getCreditSimulationPdfUrl(id);
    window.open(pdfUrl, '_blank');
  };

  if (loading) {
    return <LoadingState message="Cargando resultado de simulación..." />;
  }

  if (error || !simulation) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-primary">Simulación no disponible</h2>
        <p className="text-sm text-gray-500">{error || 'No se encontró la simulación solicitada.'}</p>
        <Link to="/creditos/simulador">
          <Button variant="outline">Volver al simulador</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 md:py-10 space-y-8">
      {/* Cabecera y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-2">
            <Link to="/creditos/simulador" className="hover:text-primary transition-colors">
              Simulador
            </Link>
            <span>/</span>
            <span className="text-primary font-medium">Resultado #{id.slice(0, 8)}</span>
          </div>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-primary tracking-tight">
            Resultado de la simulación
          </h1>
          <p className="text-[14px] text-on-surface-variant mt-1">
            Sistema: <strong>{simulation.sistemaAmortizacion === 'FRANCES' ? 'Francés (Cuota fija)' : 'Alemán (Cuotas decrecientes)'}</strong> • Fecha primer pago: {simulation.fechaInicio}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleDownloadPdf} iconName="download">
            Descargar PDF
          </Button>
          <Button variant="fintech" onClick={handleApply} iconName="send">
            Solicitar crédito
          </Button>
        </div>
      </div>

      {/* Tarjetas de Resumen Financiero con Iconos Vivos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[13px] text-gray-500 font-medium">Monto</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">payments</span>
          </div>
          <span className="text-[18px] font-bold text-primary font-numeric-data mt-2 block">
            {formatUSD(simulation.monto)}
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[13px] text-gray-500 font-medium">Plazo</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">calendar_month</span>
          </div>
          <span className="text-[18px] font-bold text-primary font-numeric-data mt-2 block">
            {simulation.plazoMeses} meses
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[13px] text-gray-500 font-medium">Tasa anual</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">trending_up</span>
          </div>
          <span className="text-[18px] font-bold text-secondary font-numeric-data mt-2 block">
            {Number(simulation.tasaAnual).toFixed(2)}%
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[13px] text-gray-500 font-medium">Cuota inicial</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">schedule</span>
          </div>
          <span className="text-[18px] font-bold text-primary font-numeric-data mt-2 block">
            {formatUSD(simulation.cuotaInicial)}
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[13px] text-gray-500 font-medium">Intereses</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">savings</span>
          </div>
          <span className="text-[18px] font-bold text-emerald-700 font-numeric-data mt-2 block">
            {formatUSD(simulation.totalIntereses)}
          </span>
        </div>

        <div className="bg-blue-50/70 p-5 rounded-xl border border-blue-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-[13px] text-secondary font-semibold">Total a pagar</span>
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          </div>
          <span className="text-[18px] font-bold text-primary font-numeric-data mt-2 block">
            {formatUSD(simulation.totalPagar)}
          </span>
        </div>
      </div>

      {/* Tabla de Amortización con ENCABEZADO AZUL */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <span className="material-symbols-outlined text-[22px] text-secondary">table_view</span>
          <h3 className="text-[18px] font-bold text-primary">
            Tabla de amortización detallada
          </h3>
        </div>

        <div className="overflow-x-auto rounded-lg border border-primary/20 shadow-xs">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#0b2545] text-white font-semibold">
              <tr>
                <th className="py-3.5 px-4 text-center text-blue-100 font-semibold">N°</th>
                <th className="py-3.5 px-4 text-blue-100 font-semibold">Fecha de Pago</th>
                <th className="py-3.5 px-4 text-right text-blue-100 font-semibold">Saldo Inicial</th>
                <th className="py-3.5 px-4 text-right text-blue-100 font-semibold">Capital</th>
                <th className="py-3.5 px-4 text-right text-blue-100 font-semibold">Interés</th>
                <th className="py-3.5 px-4 text-right text-blue-100 font-semibold">Cargos / SOLCA</th>
                <th className="py-3.5 px-4 text-right text-white font-bold bg-[#001026]">Cuota Total</th>
                <th className="py-3.5 px-4 text-right text-blue-100 font-semibold">Saldo Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-numeric-data">
              {rows.map((row) => (
                <tr key={row.numeroCuota} className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-2.5 px-4 text-center font-medium text-gray-600">{row.numeroCuota}</td>
                  <td className="py-2.5 px-4 text-gray-600">{row.fechaPago}</td>
                  <td className="py-2.5 px-4 text-right">{formatUSD(row.saldoInicial)}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-primary">{formatUSD(row.capital)}</td>
                  <td className="py-2.5 px-4 text-right text-secondary font-medium">{formatUSD(row.interes)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-500">{formatUSD(row.cargos)}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-primary bg-blue-50/20">{formatUSD(row.totalPago)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-600">{formatUSD(row.saldoFinal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#e6eeff] font-bold font-numeric-data border-t-2 border-primary/30 text-primary">
              <tr>
                <td className="py-3.5 px-4 text-left" colSpan={3}>Totales acumulados</td>
                <td className="py-3.5 px-4 text-right">{formatUSD(simulation.monto)}</td>
                <td className="py-3.5 px-4 text-right text-emerald-800">{formatUSD(simulation.totalIntereses)}</td>
                <td className="py-3.5 px-4 text-right text-gray-700">{formatUSD(simulation.totalCargos)}</td>
                <td className="py-3.5 px-4 text-right text-primary bg-[#d5e3fd]">{formatUSD(simulation.totalPagar)}</td>
                <td className="py-3.5 px-4 text-right">$ 0.00</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
