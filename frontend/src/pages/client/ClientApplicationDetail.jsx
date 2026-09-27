import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clientService } from '../../services/api';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import CreditSummary from '../../components/credit/CreditSummary';
import AmortizationTable from '../../components/credit/AmortizationTable';
import ApplicationStatusBanner from '../../components/application/ApplicationStatusBanner';
import DocumentChecklist from '../../components/application/DocumentChecklist';
import PrepaymentSimulator from '../../components/credit/PrepaymentSimulator';
import { formatDateTime, formatMoney } from '../../utils/format';

export default function ClientApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState(null);

  const loadApplication = () => {
    clientService
      .getCreditApplicationById(id)
      .then((res) => setApplication(res.data.application))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadApplication();
  }, [id]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      await clientService.downloadCreditApplicationPdf(application);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Cargando solicitud..." />;
  }

  if (!application) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-[14px] text-on-surface-variant">{error || 'No encontramos esta solicitud.'}</p>
        <Link to="/cliente/solicitudes">
          <Button variant="outline" size="sm" iconName="arrow_back">Volver a mis solicitudes</Button>
        </Link>
      </div>
    );
  }

  const simulation = application.simulation;
  const rows = simulation?.rows || [];

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link to="/cliente/solicitudes" className="text-[12px] text-secondary hover:underline">← Mis solicitudes</Link>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold mt-1">
            Solicitud {application.codigo}
          </h1>
          <p className="text-[13px] text-on-surface-variant">
            {application.creditType?.nombre} · registrada el {formatDateTime(application.createdAt)}
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
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
            {simulation ? (
              <CreditSummary simulation={simulation} rows={rows} />
            ) : (
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div><span className="block text-gray-500">Monto</span><strong>{formatMoney(application.monto)}</strong></div>
                <div><span className="block text-gray-500">Plazo</span><strong>{application.plazoMeses} meses</strong></div>
                <div><span className="block text-gray-500">Cuota estimada</span><strong>{formatMoney(application.cuotaEstimada)}</strong></div>
              </div>
            )}
          </div>

          {rows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-bold text-primary">Tabla de amortización</h2>
                <button type="button" className="text-[13px] text-secondary font-medium hover:underline" onClick={() => setShowTable((v) => !v)}>
                  {showTable ? 'Ocultar' : `Ver las ${rows.length} cuotas`}
                </button>
              </div>
              {showTable && <AmortizationTable rows={rows} simulation={simulation} />}
            </div>
          )}

          {simulation && <PrepaymentSimulator simulation={simulation} rows={rows} />}

          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-[16px] font-bold text-primary mb-3">Datos del solicitante</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              {[
                ['Nombre', `${application.nombres} ${application.apellidos}`],
                ['Cédula', application.cedula],
                ['Ciudad', application.ciudad],
                ['Dirección', application.direccion],
                ['Teléfono', application.telefono],
                ['Actividad económica', application.actividadEconomica || '—'],
                ['Ingresos mensuales', formatMoney(application.ingresosMensuales)],
                ['Gastos mensuales', formatMoney(application.egresosMensuales)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-gray-100 py-1.5">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="text-primary font-medium text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="lg:col-span-5">
          <DocumentChecklist application={application} applicationField="creditApplicationId" onUploaded={loadApplication} />
        </div>
      </div>
    </div>
  );
}
