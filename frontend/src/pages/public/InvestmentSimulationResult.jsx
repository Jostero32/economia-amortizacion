import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { publicService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import InterestSchedule from '../../components/investment/InterestSchedule';
import { formatMoney, formatPercent, formatDate } from '../../utils/format';

function DetailRow({ label, value, strong = false }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-100 last:border-0 text-[14px]">
      <span className="text-gray-600">{label}</span>
      <span className={`font-numeric-data ${strong ? 'font-bold text-primary' : 'text-primary'}`}>{value}</span>
    </div>
  );
}

export default function InvestmentSimulationResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isClient } = useAuth();

  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicService
      .getInvestmentSimulation(id)
      .then((res) => setSimulation(res.data?.simulation || null))
      .catch((err) => setError(err.message || 'No se pudo cargar la simulación de inversión.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApply = () => {
    const target = `/cliente/solicitudes?invSimulationId=${id}`;
    if (!isAuthenticated) {
      navigate('/login', {
        state: { from: target, message: 'Inicia sesión para registrar tu solicitud de inversión.' },
      });
    } else {
      navigate(target);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      await publicService.downloadInvestmentSimulationPdf(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando simulación de inversión..." />;
  }

  if (!simulation) {
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

  const retention = Number(simulation.retencionIR || 0);
  const grossInterest = Number(simulation.interesGanado || 0);
  const netInterest = Number(simulation.interesNeto ?? grossInterest - retention);

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-8 py-8 md:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-2">
            <Link to="/inversiones/simulador" className="hover:text-primary">Simulador</Link>
            <span>/</span>
            <span className="text-primary font-medium">Resultado #{id.slice(0, 8)}</span>
          </div>
          <h1 className="text-[26px] sm:text-[30px] font-bold text-primary tracking-tight">
            {simulation.product?.nombre || 'Depósito a plazo fijo'}
          </h1>
          <p className="text-[14px] text-on-surface-variant mt-1">
            {simulation.plazoDias} días · del {formatDate(simulation.fechaInicio)} al {formatDate(simulation.fechaVencimiento)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" iconName="download" onClick={handleDownloadPdf} loading={downloading} loadingText="Descargando...">
            Descargar PDF
          </Button>
          {(!isAuthenticated || isClient) && (
            <Button variant="fintech" iconName="send" onClick={handleApply}>
              Solicitar esta inversión
            </Button>
          )}
        </div>
      </div>

      {error && <Alert type="error" title="No pudimos completar la operación">{error}</Alert>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-5">
        <div>
          <span className="text-[13px] text-gray-500 block">
            {simulation.pagoIntereses === 'MENSUAL' ? 'Total que recibirás (capital e intereses netos)' : 'Recibirás al vencimiento'}
          </span>
          <span className="text-[34px] font-bold text-primary font-numeric-hero">{formatMoney(simulation.valorFinal)}</span>
        </div>
        <div>
          <DetailRow label="Capital invertido" value={formatMoney(simulation.monto)} />
          <DetailRow label="Tasa de interés nominal anual" value={formatPercent(simulation.tasaAnual)} />
          {simulation.tasaEfectiva != null && (
            <DetailRow label="Tasa efectiva anual (TEA)" value={formatPercent(simulation.tasaEfectiva)} />
          )}
          <DetailRow label="Interés ganado" value={formatMoney(grossInterest)} />
          <DetailRow
            label="Retención Impuesto a la Renta"
            value={retention > 0 ? `− ${formatMoney(retention)} (${formatPercent(simulation.tasaRetencion, 2, 0)})` : 'Exento'}
          />
          <DetailRow label="Ganancia neta" value={formatMoney(netInterest)} strong />
        </div>
        {simulation.pagoIntereses === 'MENSUAL' && simulation.cronogramaPagos?.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-[15px] font-bold text-primary">Pagos de intereses cada 30 días</h2>
            <InterestSchedule pagos={simulation.cronogramaPagos} />
          </div>
        )}
        <p className="text-[12px] text-gray-500">
          Interés simple con base comercial de 360 días. Valores referenciales; las condiciones finales se
          confirman al abrir el depósito.
        </p>
      </div>
    </div>
  );
}
