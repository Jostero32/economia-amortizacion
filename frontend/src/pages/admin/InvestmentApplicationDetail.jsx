import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminService, clientService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';

const REQUIRED_DOCUMENT_TYPES = ['CEDULA', 'COMPROBANTE_DOMICILIO', 'COMPROBANTE_INGRESOS', 'SELFIE'];

export default function InvestmentApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [estado, setEstado] = useState('PENDIENTE');
  const [observacionAsesor, setObservacionAsesor] = useState('');
  const [biometriaValidada, setBiometriaValidada] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadApplication = async () => {
    try {
      const response = await adminService.getInvestmentApplicationById(id);
      if (response.success) {
        const data = response.data.application;
        setApplication(data);
        setEstado(data.estado);
        setObservacionAsesor(data.observacionAsesor || '');
        setBiometriaValidada(Boolean(data.biometriaValidada));
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
  }, [id]);

  const updateDocumentStatus = async (documentId, status) => {
    setError(null);
    try {
      await adminService.updateDocumentStatus(documentId, {
        estado: status,
        comentarioRevision: `Revisado el ${new Date().toLocaleDateString('es-EC')}`,
      });
      await loadApplication();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el documento.');
    }
  };

  const updateApplication = async (event) => {
    event.preventDefault();
    setUpdating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await adminService.updateApplicationStatus(id, {
        tipo: 'INVERSION',
        estado,
        observacionAsesor,
        biometriaValidada,
      });
      setSuccessMessage('Solicitud de inversión actualizada correctamente.');
      await loadApplication();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la solicitud.');
    } finally {
      setUpdating(false);
    }
  };

  const formatUSD = (value) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);

  if (loading) return <LoadingState message="Cargando expediente de inversión..." />;

  if (!application) {
    return (
      <div className="py-12 text-center space-y-3">
        <p>Solicitud de inversión no encontrada.</p>
        <Link to="/admin/solicitudes"><Button variant="outline">Volver</Button></Link>
      </div>
    );
  }

  const validatedTypes = new Set(
    (application.documents || []).filter((document) => document.estado === 'VALIDADO').map((document) => document.tipo)
  );
  const missingTypes = REQUIRED_DOCUMENT_TYPES.filter((type) => !validatedTypes.has(type));

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link to="/admin/solicitudes" className="text-[12px] text-secondary hover:underline">← Bandeja de solicitudes</Link>
          <h1 className="font-headline-lg text-[26px] text-primary font-bold mt-1">Revisión de solicitud de inversión</h1>
          <p className="text-[13px] text-on-surface-variant">
            {application.nombres} {application.apellidos} · {application.codigo || application.id.slice(0, 8)}
          </p>
        </div>
        <Badge variant={application.estado} size="lg">{application.estado}</Badge>
      </div>

      {error && <Alert type="error" title="No se pudo completar la operación">{error}</Alert>}
      {successMessage && <Alert type="success" title="Actualizado">{successMessage}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        <div className="lg:col-span-7 space-y-space-md">
          <Card title="Datos del inversionista" iconName="person">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[12px]">
              <div><span className="block text-on-surface-variant">Cédula</span><strong>{application.cedula}</strong></div>
              <div><span className="block text-on-surface-variant">Teléfono</span><strong>{application.telefono}</strong></div>
              <div><span className="block text-on-surface-variant">Correo</span><strong>{application.email}</strong></div>
              <div><span className="block text-on-surface-variant">Actividad económica</span><strong>{application.actividadEconomica}</strong></div>
              <div><span className="block text-on-surface-variant">Ingresos mensuales</span><strong>{formatUSD(application.ingresosMensuales)}</strong></div>
              <div><span className="block text-on-surface-variant">Origen de fondos</span><strong>{application.origenFondos}</strong></div>
              <div className="sm:col-span-3"><span className="block text-on-surface-variant">Finalidad de la inversión</span><strong>{application.finalidadInversion}</strong></div>
            </div>
          </Card>

          <Card title="Condiciones de inversión" iconName="savings">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[12px]">
              <div><span className="block text-on-surface-variant">Producto</span><strong>{application.product?.nombre}</strong></div>
              <div><span className="block text-on-surface-variant">Capital</span><strong>{formatUSD(application.monto)}</strong></div>
              <div><span className="block text-on-surface-variant">Plazo</span><strong>{application.plazoDias} días</strong></div>
              <div><span className="block text-on-surface-variant">Tasa</span><strong>{Number(application.tasaAplicada).toFixed(2)}%</strong></div>
              <div><span className="block text-on-surface-variant">Valor final</span><strong>{formatUSD(application.valorFinalEstimado)}</strong></div>
            </div>
          </Card>

          <Card title="Documentos y verificación" iconName="folder_shared">
            {!application.documents?.length ? (
              <p className="py-6 text-center text-[12px] text-on-surface-variant">El cliente aún no ha cargado documentos.</p>
            ) : (
              <div className="space-y-2">
                {application.documents.map((document) => (
                  <div key={document.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-surface-container-high p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><strong className="text-[12px]">{document.tipo}</strong><Badge variant={document.estado} size="sm">{document.estado}</Badge></div>
                      <span className="block text-[11px] text-on-surface-variant truncate">{document.nombreArchivo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={clientService.getDocumentUrl(document.id)} target="_blank" rel="noreferrer" className="text-[12px] text-secondary hover:underline">Ver</a>
                      <Button type="button" size="sm" variant="outline" onClick={() => updateDocumentStatus(document.id, 'VALIDADO')}>Validar</Button>
                      <Button type="button" size="sm" variant="danger" onClick={() => updateDocumentStatus(document.id, 'RECHAZADO')}>Rechazar</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-space-md">
          <Card title="Control de requisitos" iconName="fact_check">
            <div className="space-y-2 text-[12px]">
              {REQUIRED_DOCUMENT_TYPES.map((type) => (
                <div key={type} className="flex justify-between rounded-lg bg-surface-container-low p-2.5">
                  <span>{type}</span>
                  <strong className={validatedTypes.has(type) ? 'text-emerald-700' : 'text-amber-700'}>
                    {validatedTypes.has(type) ? 'VALIDADO' : 'PENDIENTE'}
                  </strong>
                </div>
              ))}
            </div>
            {missingTypes.length > 0 && (
              <p className="mt-3 text-[11px] text-amber-800">No podrá aprobarse hasta validar todos los documentos.</p>
            )}
          </Card>

          <Card title="Resolución del asesor" iconName="gavel">
            <form onSubmit={updateApplication} className="space-y-4">
              <div>
                <label htmlFor="investment-status" className="block text-[13px] font-semibold text-primary mb-1">Estado</label>
                <select id="investment-status" value={estado} onChange={(event) => setEstado(event.target.value)} className="w-full h-11 px-3 rounded-lg border border-surface-container-high bg-surface-container-low text-[13px]">
                  <option value="PENDIENTE">PENDIENTE</option>
                  <option value="EN_REVISION">EN REVISIÓN</option>
                  <option value="PENDIENTE_DOCUMENTOS">PENDIENTE DOCUMENTOS</option>
                  <option value="APROBADA">APROBADA</option>
                  <option value="RECHAZADA">RECHAZADA</option>
                </select>
              </div>
              <label className="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-[12px] cursor-pointer">
                <input type="checkbox" checked={biometriaValidada} onChange={(event) => setBiometriaValidada(event.target.checked)} className="mt-0.5" />
                <span><strong className="block text-primary">Biometría facial validada</strong>La cédula y la selfie corresponden al solicitante.</span>
              </label>
              <div>
                <label htmlFor="investment-observation" className="block text-[13px] font-semibold text-primary mb-1">Observación</label>
                <textarea id="investment-observation" rows={4} value={observacionAsesor} onChange={(event) => setObservacionAsesor(event.target.value)} className="w-full p-3 rounded-lg border border-surface-container-high bg-surface-container-low text-[13px]" />
              </div>
              <Button type="submit" variant="fintech" className="w-full" loading={updating} loadingText="Guardando..." iconName="save">Guardar resolución</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
