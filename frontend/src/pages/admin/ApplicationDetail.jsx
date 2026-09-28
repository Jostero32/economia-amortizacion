import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminService, clientService } from '../../services/api';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import CreditSummary, { MAX_DEBT_TO_INCOME } from '../../components/credit/CreditSummary';
import AmortizationTable from '../../components/credit/AmortizationTable';
import AdvisorReviewPanel from '../../components/application/AdvisorReviewPanel';
import { formatMoney, formatPercent, formatDate, formatDateTime } from '../../utils/format';

export default function ApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState(null);

  const loadApplication = () => {
    adminService
      .getApplicationById(id)
      .then((res) => setApplication({ ...res.data.application, identidad: res.data.identidad }))
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
        <p className="text-[13px] text-on-surface-variant">{error || 'Solicitud no encontrada.'}</p>
        <Link to="/admin/solicitudes">
          <Button variant="outline" size="sm" iconName="arrow_back">Volver a la lista</Button>
        </Link>
      </div>
    );
  }

  const simulation = application.simulation;
  const rows = simulation?.rows || [];
  const ingresos = Number(application.ingresosMensuales);
  const egresos = Number(application.egresosMensuales);
  const relacion = application.relacionCuotaIngreso != null ? Number(application.relacionCuotaIngreso) : null;

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link to="/admin/solicitudes" className="text-[12px] text-secondary hover:underline">← Solicitudes</Link>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold mt-1">
            Solicitud de crédito {application.codigo}
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
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-4">
            <h2 className="text-[16px] font-bold text-primary">Capacidad de pago</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
              <div><span className="block text-gray-500">Ingresos</span><strong>{formatMoney(ingresos)}</strong></div>
              <div><span className="block text-gray-500">Gastos</span><strong>{formatMoney(egresos)}</strong></div>
              <div><span className="block text-gray-500">Disponible</span><strong>{formatMoney(ingresos - egresos)}</strong></div>
              <div>
                <span className="block text-gray-500">Cuota / ingreso</span>
                <strong className={relacion !== null && relacion > MAX_DEBT_TO_INCOME * 100 ? 'text-red-700' : 'text-emerald-700'}>
                  {relacion !== null ? formatPercent(relacion, 1, 0) : '—'}
                </strong>
              </div>
            </div>
            {relacion !== null && relacion > MAX_DEBT_TO_INCOME * 100 && (
              <Alert type="warning">La cuota supera el 40 % de los ingresos del solicitante.</Alert>
            )}
            {application.autorizaConsultaBuro && (
              <p className="text-[12px] text-gray-500">
                Consulta del historial crediticio autorizada por el cliente: {formatDateTime(application.fechaAutorizacionBuro)}
              </p>
            )}
          </div>

          {simulation && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
              <CreditSummary simulation={simulation} rows={rows} />
            </div>
          )}

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

          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6">
            <h2 className="text-[16px] font-bold text-primary mb-3">Datos del solicitante</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
              {[
                ['Fecha de nacimiento', formatDate(application.fechaNacimiento)],
                ['Estado civil', application.estadoCivil || '—'],
                ['Teléfono', application.telefono],
                ['Correo', application.email],
                ['Ciudad', application.ciudad],
                ['Dirección', application.direccion],
                ['Actividad económica', application.actividadEconomica || '—'],
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
          <AdvisorReviewPanel application={application} tipo="CREDITO" onUpdated={loadApplication} />
        </div>
      </div>
    </div>
  );
}
