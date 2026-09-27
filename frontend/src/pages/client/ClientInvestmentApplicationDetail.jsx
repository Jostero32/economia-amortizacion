import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { clientService } from '../../services/api';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import ApplicationStatusBanner from '../../components/application/ApplicationStatusBanner';
import DocumentChecklist from '../../components/application/DocumentChecklist';
import { formatMoney, formatPercent, formatDate, formatDateTime } from '../../utils/format';

function Row({ label, value, strong = false }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-gray-100 last:border-0 text-[14px]">
      <span className="text-gray-600">{label}</span>
      <span className={`font-numeric-data text-right ${strong ? 'font-bold text-primary' : 'text-primary'}`}>{value}</span>
    </div>
  );
}

export default function ClientInvestmentApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const loadApplication = async () => {
    try {
      const response = await clientService.getInvestmentApplicationById(id);
      setApplication(response.data.application);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la solicitud de inversión.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
  }, [id]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      await clientService.downloadInvestmentApplicationPdf(application);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <LoadingState message="Cargando solicitud de inversión..." />;

  if (!application) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-on-surface-variant">{error || 'No encontramos esta solicitud de inversión.'}</p>
        <Link to="/cliente/solicitudes"><Button variant="outline">Volver</Button></Link>
      </div>
    );
  }

  const simulation = application.simulation;
  const retention = Number(simulation?.retencionIR || 0);

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link to="/cliente/solicitudes" className="text-[12px] text-secondary hover:underline">← Mis solicitudes</Link>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold mt-1">
            Solicitud {application.codigo}
          </h1>
          <p className="text-[13px] text-on-surface-variant">
            {application.product?.nombre} · registrada el {formatDateTime(application.createdAt)}
          </p>
        </div>
        {simulation && (
          <Button variant="outline" iconName="download" onClick={handleDownloadPdf} loading={downloading} loadingText="Descargando...">
            Descargar PDF
          </Button>
        )}
      </div>

      {error && <Alert type="error" title="No pudimos completar la operación">{error}</Alert>}

      <ApplicationStatusBanner application={application} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        <div className="lg:col-span-7 space-y-space-md">
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-3">
            <div>
              <span className="text-[13px] text-gray-500 block">Recibirás al vencimiento</span>
              <span className="text-[32px] font-bold text-primary font-numeric-hero">
                {formatMoney(application.valorFinalEstimado)}
              </span>
            </div>
            <div>
              <Row label="Capital" value={formatMoney(application.monto)} />
              <Row label="Plazo" value={`${application.plazoDias} días`} />
              {simulation && <Row label="Vencimiento estimado" value={formatDate(simulation.fechaVencimiento)} />}
              <Row label="Tasa de interés nominal anual" value={formatPercent(application.tasaAplicada)} />
              <Row label="Interés ganado" value={formatMoney(application.interesEstimado)} />
              {simulation && (
                <Row label="Retención Impuesto a la Renta" value={retention > 0 ? `− ${formatMoney(retention)}` : 'Exento'} />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-[16px] font-bold text-primary mb-3">Declaración del cliente</h2>
            <div>
              <Row label="Actividad económica" value={application.actividadEconomica} />
              <Row label="Ingresos mensuales" value={formatMoney(application.ingresosMensuales)} />
              <Row label="Origen de los fondos" value={application.origenFondos} />
              <Row label="Finalidad" value={application.finalidadInversion} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <DocumentChecklist application={application} applicationField="investmentApplicationId" onUploaded={loadApplication} />
        </div>
      </div>
    </div>
  );
}
