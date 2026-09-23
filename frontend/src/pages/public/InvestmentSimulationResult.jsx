import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { publicService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import { LoadingState } from '../../components/Spinner';

export default function InvestmentSimulationResult() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [simulation, setSimulation] = useState(location.state?.simulationData?.simulation || null);
  const [loading, setLoading] = useState(!simulation);
  const [error, setError] = useState(null);

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0);

  useEffect(() => {
    if (!simulation) {
      publicService
        .getInvestmentSimulation(id)
        .then((res) => {
          if (res.success && res.data?.simulation) {
            setSimulation(res.data.simulation);
          }
        })
        .catch((err) => {
          setError(err.message || 'Error al cargar la simulación de inversión');
        })
        .finally(() => setLoading(false));
    }
  }, [id, simulation]);

  const handleApply = () => {
    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: `/cliente/solicitudes?invSimulationId=${id}`,
          message: 'Inicia sesión para formalizar la solicitud de depósito a plazo.',
        },
      });
    } else {
      navigate(`/cliente/solicitudes?invSimulationId=${id}`);
    }
  };

  const handleDownloadPdf = () => {
    const pdfUrl = publicService.getInvestmentSimulationPdfUrl(id);
    window.open(pdfUrl, '_blank');
  };

  if (loading) {
    return <LoadingState message="Cargando proyección de inversión..." />;
  }

  if (error || !simulation) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-primary">Simulación no disponible</h2>
        <p className="text-sm text-gray-500">{error || 'No se encontró la simulación solicitada.'}</p>
        <Link to="/inversiones/simulador">
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
            <Link to="/inversiones/simulador" className="hover:text-primary transition-colors">
              Simulador
            </Link>
            <span>/</span>
            <span className="text-primary font-medium">Resultado #{id.slice(0, 8)}</span>
          </div>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-primary tracking-tight">
            Proyección del depósito a plazo (DPF)
          </h1>
          <p className="text-[14px] text-on-surface-variant mt-1">
            Plazo: {simulation.plazoDias} días • Fecha de vencimiento: {simulation.fechaVencimiento}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleDownloadPdf}>
            Descargar PDF
          </Button>
          <Button variant="fintech" onClick={handleApply}>
            Solicitar esta inversión →
          </Button>
        </div>
      </div>

      {/* Tarjetas de Resumen Financiero */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-1">
          <span className="text-[13px] text-gray-500 block">Capital invertido</span>
          <span className="text-[26px] font-bold text-primary font-numeric-data block">
            {formatUSD(simulation.monto)}
          </span>
          <span className="text-[12px] text-gray-500 block">Dólares americanos</span>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-1">
          <span className="text-[13px] text-gray-500 block">Tasa de rendimiento</span>
          <span className="text-[26px] font-bold text-secondary font-numeric-data block">
            {Number(simulation.tasaAnual).toFixed(2)}%
          </span>
          <span className="text-[12px] text-gray-500 block">TEA Anual fija</span>
        </div>

        <div className="bg-blue-50/60 p-6 rounded-xl border border-blue-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-1">
          <span className="text-[13px] text-secondary font-medium block">Ganancia neta estimada</span>
          <span className="text-[26px] font-bold text-primary font-numeric-data block">
            +{formatUSD(simulation.rendimiento || simulation.interesGanado)}
          </span>
          <span className="text-[12px] text-gray-500 block">Al término de {simulation.plazoDias} días</span>
        </div>
      </div>

      {/* Detalle de Liquidación */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-4">
        <h3 className="text-[17px] font-bold text-primary pb-3 border-b border-gray-100">
          Detalle de liquidación al vencimiento
        </h3>

        <div className="space-y-3 text-[14px]">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Fecha de constitución:</span>
            <span className="font-semibold text-primary">{simulation.fechaInicio}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Fecha de vencimiento:</span>
            <span className="font-semibold text-primary">{simulation.fechaVencimiento}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Plazo en días:</span>
            <span className="font-semibold text-primary">{simulation.plazoDias} días</span>
          </div>
          <div className="flex justify-between pt-3 text-[16px] font-bold text-primary">
            <span>Total a recibir al vencimiento:</span>
            <span className="text-[20px] text-secondary font-numeric-data">
              {formatUSD(simulation.valorFinal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
