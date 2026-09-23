import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clientService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';

export default function ClientApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState('CEDULA');

  const loadApplication = () => {
    clientService
      .getCreditApplicationById(id)
      .then((res) => {
        if (res.success) setApplication(res.data.application);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadApplication();
  }, [id]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Por favor selecciona un archivo para subir.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('archivo', selectedFile);
      formData.append('tipo', docType);
      formData.append('creditApplicationId', id);

      const res = await clientService.uploadDocument(formData);
      if (res.success) {
        setSuccessMsg(`Documento (${docType}) cargado exitosamente. Ahora será revisado por el asesor.`);
        setSelectedFile(null);
        const fileInput = document.getElementById('file-upload-input');
        if (fileInput) fileInput.value = '';
        loadApplication();
      }
    } catch (err) {
      setError(err.message || 'Error al subir el documento.');
    } finally {
      setUploading(false);
    }
  };

  const formatUSD = (val) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0);

  if (loading) {
    return <LoadingState message="Cargando expediente de la solicitud..." />;
  }

  if (!application) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-on-surface-variant font-body-sm text-[13px]">
          Solicitud no encontrada en el sistema.
        </p>
        <Link to="/cliente/solicitudes">
          <Button variant="outline" size="sm" iconName="arrow_back">
            Volver a mis solicitudes
          </Button>
        </Link>
      </div>
    );
  }

  // Determine timeline step based on application status and docs
  const hasDocuments = application.documents && application.documents.length > 0;
  const isEnRevision = application.estado === 'EN_REVISION';
  const isFinalizado = application.estado === 'APROBADA' || application.estado === 'RECHAZADA';

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-[12px] mb-1">
            <Link to="/cliente/solicitudes" className="hover:text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              Mis solicitudes
            </Link>
            <span>/</span>
            <span className="text-primary font-semibold">
              Expediente #{application.codigo || application.id.slice(0, 8)}
            </span>
          </div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Expediente de Solicitud de Crédito
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            Producto: <strong>{application.creditType?.nombre}</strong> • Registrada el{' '}
            {new Date(application.createdAt).toLocaleDateString('es-EC')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={application.estado} size="lg">
            {application.estado}
          </Badge>
        </div>
      </div>

      {successMsg && (
        <Alert type="success" title="Completado">{successMsg}</Alert>
      )}

      {error && (
        <Alert type="error" title="Error">{error}</Alert>
      )}

      {/* Timeline Visual Component (Requerimiento 26) */}
      <Card title="Progreso de la Solicitud (Timeline)">
        <div className="py-2">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
            {/* Step 1: Solicitud Creada */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[14px]">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </span>
                <span className="font-title-md text-[13px] text-primary font-bold">
                  1. Solicitud Creada
                </span>
              </div>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                Parámetros y datos registrados
              </span>
            </div>

            {/* Step 2: Documentos */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${
                    hasDocuments
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-secondary text-on-secondary shadow-xs ring-4 ring-secondary/20'
                  }`}
                >
                  {hasDocuments ? (
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  ) : (
                    '2'
                  )}
                </span>
                <span className="font-title-md text-[13px] text-primary font-bold">
                  2. Documentos
                </span>
              </div>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                {hasDocuments
                  ? `${application.documents.length} archivo(s) cargado(s)`
                  : 'Carga de Cédula y Selfie'}
              </span>
            </div>

            {/* Step 3: En Revisión */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${
                    isFinalizado
                      ? 'bg-emerald-100 text-emerald-800'
                      : isEnRevision
                      ? 'bg-secondary text-on-secondary shadow-xs ring-4 ring-secondary/20'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {isFinalizado ? (
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  ) : (
                    '3'
                  )}
                </span>
                <span className="font-title-md text-[13px] text-primary font-bold">
                  3. En Revisión
                </span>
              </div>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                Análisis de riesgo y asesoría
              </span>
            </div>

            {/* Step 4: Resultado */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${
                    application.estado === 'APROBADA'
                      ? 'bg-emerald-600 text-white'
                      : application.estado === 'RECHAZADA'
                      ? 'bg-red-600 text-white'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {application.estado === 'APROBADA' ? (
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  ) : application.estado === 'RECHAZADA' ? (
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  ) : (
                    '4'
                  )}
                </span>
                <span className="font-title-md text-[13px] text-primary font-bold">
                  4. Resultado
                </span>
              </div>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                {application.estado === 'APROBADA'
                  ? 'Crédito Aprobado'
                  : application.estado === 'RECHAZADA'
                  ? 'No aprobada'
                  : 'Resolución final'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Left Column: Data & Simulation Summary (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-space-md">
          {/* Datos del Cliente y Operación */}
          <Card title="Datos del Solicitante y Resumen Financiero" iconName="person">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12px]">
              <div>
                <span className="text-on-surface-variant block font-badge-label uppercase text-[10px]">
                  Nombres y Apellidos
                </span>
                <span className="font-title-md text-primary font-bold">
                  {application.nombres} {application.apellidos}
                </span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-badge-label uppercase text-[10px]">
                  Cédula
                </span>
                <span className="font-numeric-data text-primary font-bold">{application.cedula}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-badge-label uppercase text-[10px]">
                  Ciudad / Domicilio
                </span>
                <span className="text-primary font-medium">{application.ciudad}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-badge-label uppercase text-[10px]">
                  Actividad Económica
                </span>
                <span className="text-primary font-medium">{application.actividadEconomica}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-badge-label uppercase text-[10px]">
                  Ingresos Mensuales
                </span>
                <span className="font-numeric-data text-emerald-800 font-bold">
                  {formatUSD(application.ingresosMensuales)}
                </span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-badge-label uppercase text-[10px]">
                  Egresos Mensuales
                </span>
                <span className="font-numeric-data text-primary font-bold">
                  {formatUSD(application.egresosMensuales)}
                </span>
              </div>
            </div>

            {/* Financial Parameters Box */}
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

          {/* Biometría Simulada Banner */}
          <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[24px]">face</span>
              </div>
              <div>
                <span className="font-title-md text-[13px] text-primary font-bold block">
                  Validación Biométrica Facial (Simulada)
                </span>
                <span className="font-body-sm text-[11px] text-on-surface-variant">
                  {application.biometriaValidada
                    ? 'Biometría verificada y validada exitosamente por el asesor.'
                    : 'Validación biométrica simulada. Sube tu selfie con cédula para verificación del asesor.'}
                </span>
              </div>
            </div>
            <div>
              {application.biometriaValidada ? (
                <Badge variant="seps" size="md" iconName="check_circle">
                  Validado
                </Badge>
              ) : (
                <Badge variant="warning" size="md" iconName="schedule">
                  Pendiente
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Documents Upload & Management (5 Cols) (Requerimiento 24) */}
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          {/* Carga de Documentos */}
          <Card title="Carga de Documentos Probatorios" iconName="upload_file">
            <form onSubmit={handleUpload} className="space-y-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="font-title-md text-[12px] text-primary" htmlFor="docType">
                  Tipo de Documento Requerido
                </label>
                <div className="relative">
                  <select
                    id="docType"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full h-11 px-3.5 pr-10 rounded-lg bg-surface-container-low text-on-surface font-body-md text-[13px] border border-surface-container-high focus:outline-none focus:border-secondary appearance-none cursor-pointer"
                  >
                    <option value="CEDULA">Cédula de Identidad (PDF o Imagen)</option>
                    <option value="COMPROBANTE_DOMICILIO">Comprobante de Domicilio (Planilla de Servicios)</option>
                    <option value="COMPROBANTE_INGRESOS">Comprobante de Ingresos / Rol de Pagos</option>
                    <option value="SELFIE">Selfie para Validación Biométrica (Simulada)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">
                    expand_more
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-title-md text-[12px] text-primary">
                  Seleccionar Archivo (Máx 5MB)
                </label>
                <input
                  id="file-upload-input"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                  className="w-full text-[12px] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[12px] file:font-bold file:bg-surface-container-high file:text-primary hover:file:bg-surface-container-highest cursor-pointer border border-surface-container-high rounded-lg p-1"
                />
              </div>

              <Button
                type="submit"
                variant="fintech"
                loading={uploading}
                loadingText="Subiendo archivo..."
                className="w-full"
                iconName="cloud_upload"
              >
                Subir documento
              </Button>
            </form>
          </Card>

          {/* Listado de Documentos Adjuntos */}
          <Card title="Documentos del Expediente" iconName="folder">
            {!application.documents || application.documents.length === 0 ? (
              <p className="font-body-sm text-[12px] text-on-surface-variant py-3 text-center">
                Aún no has adjuntado documentos para esta solicitud.
              </p>
            ) : (
              <div className="space-y-2">
                {application.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-2"
                  >
                    <div className="overflow-hidden">
                      <div className="font-title-md text-[13px] text-primary truncate font-bold">
                        {doc.tipo}
                      </div>
                      <div className="font-body-sm text-[11px] text-on-surface-variant truncate">
                        {doc.nombreArchivo || 'Archivo adjunto'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={doc.estado}>{doc.estado}</Badge>
                      <a
                        href={clientService.getDocumentUrl(doc.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-secondary hover:underline text-[12px]"
                        title="Ver archivo"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
