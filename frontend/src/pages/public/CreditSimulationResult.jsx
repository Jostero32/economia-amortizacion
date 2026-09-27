import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { publicService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import CreditSummary from '../../components/credit/CreditSummary';
import AmortizationTable from '../../components/credit/AmortizationTable';
import PrepaymentSimulator from '../../components/credit/PrepaymentSimulator';

export default function CreditSimulationResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isClient } = useAuth();

  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicService
      .getCreditSimulation(id)
      .then((res) => setSimulation(res.data?.simulation || null))
      .catch((err) => setError(err.message || 'No se pudo cargar la simulación de crédito.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApply = () => {
    const target = `/cliente/solicitudes?simulationId=${id}`;
    if (!isAuthenticated) {
      navigate('/login', {
        state: { from: target, message: 'Inicia sesión para continuar con la solicitud de crédito.' },
      });
    } else {
      navigate(target);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      await publicService.downloadCreditSimulationPdf(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando simulación de crédito..." />;
  }

  if (!simulation) {
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

  const rows = simulation.rows || [];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 md:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-2">
            <Link to="/creditos/simulador" className="hover:text-primary">Simulador</Link>
            <span>/</span>
            <span className="text-primary font-medium">Resultado #{id.slice(0, 8)}</span>
          </div>
          <h1 className="text-[26px] sm:text-[30px] font-bold text-primary tracking-tight">
            {simulation.creditType?.nombre || 'Simulación de crédito'}
          </h1>
          <p className="text-[14px] text-on-surface-variant mt-1">
            {simulation.sistemaAmortizacion === 'ALEMAN' ? 'Cuota decreciente (sistema alemán)' : 'Cuota fija (sistema francés)'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" iconName="download" onClick={handleDownloadPdf} loading={downloading} loadingText="Descargando...">
            Descargar PDF
          </Button>
          {(!isAuthenticated || isClient) && (
            <Button variant="fintech" iconName="send" onClick={handleApply}>
              Solicitar este crédito
            </Button>
          )}
        </div>
      </div>

      {error && <Alert type="error" title="No pudimos completar la operación">{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
          <CreditSummary
            simulation={simulation}
            rows={rows}
            tasaMaximaBCE={simulation.creditType?.segment?.tasaMaxima}
          />
        </div>
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-3">
          <h2 className="text-[17px] font-bold text-primary">Tabla de amortización</h2>
          <AmortizationTable rows={rows} simulation={simulation} />
        </div>
      </div>

      <PrepaymentSimulator simulation={simulation} rows={rows} />
    </div>
  );
}
