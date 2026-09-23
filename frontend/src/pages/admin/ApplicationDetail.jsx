import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminService, clientService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';

export default function ApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Asesor resolution form
  const [estado, setEstado] = useState('PENDIENTE');
  const [observacionAsesor, setObservacionAsesor] = useState('');
  const [biometriaValidada, setBiometriaValidada] = useState(false);

  const loadApplication = () => {
    adminService
      .getApplicationById(id)
      .then((res) => {
        if (res.success && res.data?.application) {
          const app = res.data.application;
          setApplication(app);
          setEstado(app.estado);
          setObservacionAsesor(app.observacionAsesor || '');
          setBiometriaValidada(Boolean(app.biometriaValidada));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadApplication();
  }, [id]);

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await adminService.updateApplicationStatus(id, {
        estado,
        observacionAsesor,
        biometriaValidada,
      });

      if (res.success) {
        setSuccessMsg('Estado y resolución del asesor actualizados exitosamente.');
        loadApplication();
      }
    } catch (err) {
      setError(err.message || 'Error al actualizar el expediente.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDocumentValidate = async (docId, newDocStatus) => {
    try {
      const res = await adminService.updateDocumentStatus(docId, {
        estado: newDocStatus,
        comentarioRevision: `Revisado por asesor el ${new Date().toLocaleDateString('es-EC')}`,
      });
      if (res.success) {
        loadApplication();
      }
    } catch (err) {
      alert(err.message || 'Error al actualizar documento');
    }
  };

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0);

  if (loading) {
    return <LoadingState message="Cargando expediente para revisión del asesor..." />;
  }

  if (!application) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-on-surface-variant font-body-sm text-[13px]">
          Expediente no encontrado.
        </p>
        <Link to="/admin/solicitudes">
          <Button variant="outline" size="sm" iconName="arrow_back">
            Volver a la lista
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-[12px] mb-1">
            <Link to="/admin/solicitudes" className="hover:text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              Solicitudes
            </Link>
            <span>/</span>
            <span className="text-primary font-semibold">
              Expediente #{application.codigo || application.id.slice(0, 8)}
            </span>
          </div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Revisión de Solicitud de Crédito
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Solicitante: <strong>{application.nombres} {application.apellidos}</strong> (C.I: {application.cedula})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={application.estado} size="lg">
            {application.estado}
          </Badge>
        </div>
      </div>

      {successMsg && <Alert type="success" title="Completado">{successMsg}</Alert>}
      {error && <Alert type="error" title="Error">{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Left Column: Client Data & Loan Parameters (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-space-md">
          <Card title="Datos Socioeconómicos del Solicitante" iconName="person">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12px]">
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Cédula
                </span>
                <span className="font-numeric-data font-bold text-primary">{application.cedula}</span>
              </div>
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Teléfono
                </span>
                <span className="font-numeric-data font-medium text-primary">{application.telefono}</span>
              </div>
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Correo
                </span>
                <span className="text-primary truncate block">{application.email}</span>
              </div>
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Ciudad
                </span>
                <span className="text-primary font-medium">{application.ciudad}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Dirección
                </span>
                <span className="text-primary font-medium">{application.direccion}</span>
              </div>
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Actividad
                </span>
                <span className="text-primary font-medium">{application.actividadEconomica}</span>
              </div>
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Ingresos Mensuales
                </span>
                <span className="font-numeric-data font-bold text-emerald-800">
                  {formatUSD(application.ingresosMensuales)}
                </span>
              </div>
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Egresos Mensuales
                </span>
                <span className="font-numeric-data font-bold text-primary">
                  {formatUSD(application.egresosMensuales)}
                </span>
              </div>
            </div>

            {/* Loan parameters */}
            <div className="mt-4 pt-4 border-t border-surface-container-high bg-surface-container-low p-3.5 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Monto Solicitado
                </span>
                <span className="font-numeric-data font-bold text-primary text-[15px]">
                  {formatUSD(application.monto)}
                </span>
              </div>
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Plazo
                </span>
                <span className="font-numeric-data font-bold text-primary text-[15px]">
                  {application.plazoMeses} meses
                </span>
              </div>
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Tasa TEA
                </span>
                <span className="font-numeric-data font-bold text-secondary text-[15px]">
                  {Number(application.creditType?.tasaInstitucion || 15.2).toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="font-badge-label text-[10px] text-on-surface-variant uppercase block">
                  Sistema
                </span>
                <span className="font-title-md font-bold text-primary text-[14px]">
                  {application.sistemaAmortizacion}
                </span>
              </div>
            </div>
          </Card>

          {/* Document Review List (Requerimiento 35) */}
          <Card title="Documentos del Expediente y Verificación" iconName="folder_shared">
            {!application.documents || application.documents.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-on-surface-variant">
                El cliente aún no ha subido documentos a esta solicitud.
              </p>
            ) : (
              <div className="space-y-3">
                {application.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-title-md text-[13px] text-primary font-bold">
                          {doc.tipo}
                        </span>
                        <Badge variant={doc.estado} size="sm">
                          {doc.estado}
                        </Badge>
                      </div>
                      <div className="font-body-sm text-[11px] text-on-surface-variant truncate mt-0.5">
                        {doc.nombreArchivo || 'Archivo adjunto'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={clientService.getDocumentUrl(doc.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-[12px] font-title-md text-secondary hover:bg-surface-container-high rounded border border-surface-container-high flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Ver archivo
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDocumentValidate(doc.id, 'VALIDADO')}
                        className="px-2.5 py-1 text-[12px] font-title-md bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDocumentValidate(doc.id, 'RECHAZADO')}
                        className="px-2.5 py-1 text-[12px] font-title-md bg-red-50 text-red-800 hover:bg-red-100 rounded border border-red-200 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Advisor Action & Status Update (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          <Card title="Resolución y Cambio de Estado" iconName="gavel">
            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-title-md text-[13px] text-primary" htmlFor="estado-select">
                  Estado de la Solicitud
                </label>
                <div className="relative">
                  <select
                    id="estado-select"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="w-full h-11 px-3.5 pr-10 rounded-lg bg-surface-container-low text-primary font-title-md text-[13px] border border-surface-container-high focus:outline-none focus:border-secondary appearance-none cursor-pointer"
                  >
                    <option value="PENDIENTE">PENDIENTE</option>
                    <option value="EN_REVISION">EN REVISIÓN</option>
                    <option value="PENDIENTE_DOCUMENTOS">PENDIENTE DOCUMENTOS</option>
                    <option value="APROBADA">APROBADA</option>
                    <option value="RECHAZADA">RECHAZADA</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Checkbox Validación Biométrica Simulada */}
              <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high space-y-1.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={biometriaValidada}
                    onChange={(e) => setBiometriaValidada(e.target.checked)}
                    className="h-4 w-4 rounded accent-secondary cursor-pointer"
                  />
                  <span className="font-title-md text-[13px] text-primary font-bold">
                    Validación Biométrica Facial Aprobada
                  </span>
                </label>
                <p className="font-body-sm text-[11px] text-on-surface-variant pl-6">
                  Validación biométrica simulada: certifica que la cédula y la selfie corresponden a la misma persona física.
                </p>
              </div>

              {/* Observación del asesor */}
              <div className="flex flex-col gap-1.5">
                <label className="font-title-md text-[13px] text-primary" htmlFor="observacion-input">
                  Dictamen / Observación del Asesor
                </label>
                <textarea
                  id="observacion-input"
                  rows={4}
                  value={observacionAsesor}
                  onChange={(e) => setObservacionAsesor(e.target.value)}
                  placeholder="Ingrese el dictamen, condiciones de desembolso o razones de rechazo..."
                  className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface font-body-md text-[13px] border border-surface-container-high focus:outline-none focus:border-secondary"
                />
              </div>

              <Button
                type="submit"
                variant="fintech"
                loading={updating}
                loadingText="Guardando resolución..."
                className="w-full"
                iconName="save"
              >
                Guardar cambios del expediente
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
