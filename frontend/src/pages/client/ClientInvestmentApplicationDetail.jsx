import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { clientService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';

const DOCUMENT_OPTIONS = [
  { value: 'CEDULA', label: 'Cédula de identidad' },
  { value: 'COMPROBANTE_DOMICILIO', label: 'Comprobante de domicilio' },
  { value: 'COMPROBANTE_INGRESOS', label: 'Comprobante de ingresos' },
  { value: 'SELFIE', label: 'Selfie para validación biométrica' },
];

export default function ClientInvestmentApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState('CEDULA');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadApplication = async () => {
    try {
      const response = await clientService.getInvestmentApplicationById(id);
      if (response.success) setApplication(response.data.application);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la solicitud de inversión.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
  }, [id]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('Selecciona un archivo antes de continuar.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const body = new FormData();
      body.append('archivo', selectedFile);
      body.append('tipo', documentType);
      body.append('investmentApplicationId', id);
      await clientService.uploadDocument(body);
      setSelectedFile(null);
      setSuccessMessage('Documento cargado correctamente. Será revisado por un asesor.');
      const input = document.getElementById('investment-file-upload');
      if (input) input.value = '';
      await loadApplication();
    } catch (err) {
      setError(err.message || 'No se pudo cargar el documento.');
    } finally {
      setUploading(false);
    }
  };

  const formatUSD = (value) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);

  if (loading) return <LoadingState message="Cargando expediente de inversión..." />;

  if (!application) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-on-surface-variant">Solicitud de inversión no encontrada.</p>
        <Link to="/cliente/solicitudes"><Button variant="outline">Volver</Button></Link>
      </div>
    );
  }

  const validatedTypes = new Set(
    (application.documents || []).filter((document) => document.estado === 'VALIDADO').map((document) => document.tipo)
  );

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link to="/cliente/solicitudes" className="text-[12px] text-secondary hover:underline">← Mis solicitudes</Link>
          <h1 className="font-headline-lg text-[26px] text-primary font-bold mt-1">Expediente de inversión</h1>
          <p className="text-[13px] text-on-surface-variant">
            {application.product?.nombre} · {application.codigo || application.id.slice(0, 8)}
          </p>
        </div>
        <Badge variant={application.estado} size="lg">{application.estado}</Badge>
      </div>

      {error && <Alert type="error" title="Error">{error}</Alert>}
      {successMessage && <Alert type="success" title="Documento recibido">{successMessage}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        <div className="lg:col-span-7 space-y-space-md">
          <Card title="Resumen de la inversión" iconName="savings">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
              <div><span className="block text-on-surface-variant">Capital</span><strong>{formatUSD(application.monto)}</strong></div>
              <div><span className="block text-on-surface-variant">Plazo</span><strong>{application.plazoDias} días</strong></div>
              <div><span className="block text-on-surface-variant">Tasa anual</span><strong>{Number(application.tasaAplicada).toFixed(2)}%</strong></div>
              <div><span className="block text-on-surface-variant">Valor final</span><strong>{formatUSD(application.valorFinalEstimado)}</strong></div>
            </div>
          </Card>

          <Card title="Declaración económica" iconName="account_balance_wallet">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
              <div><span className="block text-on-surface-variant">Actividad económica</span><strong>{application.actividadEconomica}</strong></div>
              <div><span className="block text-on-surface-variant">Ingresos mensuales</span><strong>{formatUSD(application.ingresosMensuales)}</strong></div>
              <div><span className="block text-on-surface-variant">Origen de fondos</span><strong>{application.origenFondos}</strong></div>
              <div><span className="block text-on-surface-variant">Finalidad</span><strong>{application.finalidadInversion}</strong></div>
            </div>
          </Card>

          <Card title="Requisitos del expediente" iconName="fact_check">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DOCUMENT_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center justify-between rounded-lg border border-surface-container-high p-3 text-[12px]">
                  <span>{option.label}</span>
                  <Badge variant={validatedTypes.has(option.value) ? 'VALIDADO' : 'PENDIENTE'} size="sm">
                    {validatedTypes.has(option.value) ? 'VALIDADO' : 'PENDIENTE'}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[12px] text-on-surface-variant">
              Biometría: <strong>{application.biometriaValidada ? 'VALIDADA' : 'PENDIENTE'}</strong>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-space-md">
          <Card title="Cargar documento" iconName="upload_file">
            <form onSubmit={handleUpload} className="space-y-3">
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-surface-container-high bg-surface-container-low text-[13px]"
              >
                {DOCUMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input
                id="investment-file-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                className="w-full text-[12px] border border-surface-container-high rounded-lg p-2"
              />
              <Button type="submit" variant="fintech" className="w-full" loading={uploading} loadingText="Subiendo..." iconName="cloud_upload">
                Subir documento
              </Button>
            </form>
          </Card>

          <Card title="Documentos cargados" iconName="folder">
            {!application.documents?.length ? (
              <p className="py-4 text-center text-[12px] text-on-surface-variant">Aún no hay documentos.</p>
            ) : (
              <div className="space-y-2">
                {application.documents.map((document) => (
                  <div key={document.id} className="flex items-center justify-between gap-2 rounded-lg border border-surface-container-high p-3">
                    <div className="min-w-0">
                      <strong className="block text-[12px] text-primary">{document.tipo}</strong>
                      <span className="block text-[11px] text-on-surface-variant truncate">{document.nombreArchivo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={document.estado} size="sm">{document.estado}</Badge>
                      <a href={clientService.getDocumentUrl(document.id)} target="_blank" rel="noreferrer" className="text-secondary" title="Ver documento">
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {application.observacionAsesor && (
            <Alert type="info" title="Observación del asesor">{application.observacionAsesor}</Alert>
          )}
        </div>
      </div>
    </div>
  );
}
