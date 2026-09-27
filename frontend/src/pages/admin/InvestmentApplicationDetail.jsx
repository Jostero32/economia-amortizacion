import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminService, clientService } from '../../services/api';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import AdvisorReviewPanel from '../../components/application/AdvisorReviewPanel';
import { formatMoney, formatPercent, formatDate, formatDateTime } from '../../utils/format';

function Row({ label, value, strong = false }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-gray-100 last:border-0 text-[13px]">
      <span className="text-gray-500">{label}</span>
      <span className={`text-right ${strong ? 'font-bold text-primary' : 'text-primary font-medium'}`}>{value}</span>
    </div>
  );
}

export default function InvestmentApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const loadApplication = async () => {
    try {
      const response = await adminService.getInvestmentApplicationById(id);
      setApplication(response.data.application);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la solicitud.');
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
        <p className="text-[13px] text-on-surface-variant">{error || 'Solicitud de inversión no encontrada.'}</p>
        <Link to="/admin/solicitudes"><Button variant="outline">Volver</Button></Link>
      </div>
    );
  }

  const simulation = application.simulation;
  const retention = Number(simulation?.retencionIR || 0);

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link to="/admin/solicitudes" className="text-[12px] text-secondary hover:underline">← Solicitudes</Link>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold mt-1">
            Solicitud de inversión {application.codigo}
          </h1>
          <p className="text-[13px] text-on-surface-variant">
            {application.nombres} {application.apellidos} · C.I. {application.cedula} · registrada el {formatDateTime(application.createdAt)}
          </p>
        </div>
        {simulation && (
          <Button variant="outline" iconName="download" onClick={handleDownloadPdf} loading={downloading} loadingText="Descargando...">
            Descargar PDF
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        <div className="lg:col-span-7 space-y-space-md">
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-[16px] font-bold text-primary mb-2">Condiciones del depósito</h2>
            <Row label="Producto" value={application.product?.nombre} />
            {simulation?.aporteMensual != null && <Row label="Aporte mensual" value={formatMoney(simulation.aporteMensual)} />}
            <Row label={simulation?.aporteMensual != null ? 'Total a aportar' : 'Capital'} value={formatMoney(application.monto)} />
            <Row label="Plazo" value={`${application.plazoDias} días`} />
            {simulation && <Row label="Vencimiento" value={formatDate(simulation.fechaVencimiento)} />}
            <Row label="Tasa nominal anual" value={formatPercent(application.tasaAplicada)} />
            <Row label="Interés ganado" value={formatMoney(application.interesEstimado)} />
            {simulation && <Row label="Retención IR" value={retention > 0 ? `− ${formatMoney(retention)}` : 'Exento'} />}
            <Row label="Valor a recibir" value={formatMoney(application.valorFinalEstimado)} strong />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-[16px] font-bold text-primary mb-2">Datos del inversionista</h2>
            <Row label="Teléfono" value={application.telefono} />
            <Row label="Correo" value={application.email} />
            <Row label="Actividad económica" value={application.actividadEconomica} />
            <Row label="Ingresos mensuales" value={formatMoney(application.ingresosMensuales)} />
            <Row label="Origen de los fondos" value={application.origenFondos} />
            <Row label="Finalidad" value={application.finalidadInversion} />
            <Row
              label="Declaración de licitud de fondos"
              value={application.declaraLicitudFondos ? 'Firmada' : 'No registrada'}
            />
          </div>
        </div>

        <div className="lg:col-span-5">
          <AdvisorReviewPanel application={application} tipo="INVERSION" onUpdated={loadApplication} />
        </div>
      </div>
    </div>
  );
}
