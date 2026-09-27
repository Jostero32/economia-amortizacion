import React, { useState } from 'react';
import { adminService, clientService } from '../../services/api';
import Badge from '../Badge';
import Button from '../Button';
import Alert from '../Alert';
import Modal from '../Modal';
import {
  STATUS_LABELS,
  STATUS_TRANSITIONS,
  STATUSES_REQUIRING_NOTE,
  CLOSED_STATUSES,
  REQUIRED_DOCUMENTS,
  POLICY_DOCUMENT,
  DOCUMENT_STATUS,
  requiredDocumentsFor,
} from './applicationStatus';

const DOCUMENT_LABELS = Object.fromEntries(
  [...REQUIRED_DOCUMENTS, POLICY_DOCUMENT].map((doc) => [doc.tipo, doc.label])
);

/**
 * Revisión del asesor: documentos (con motivo de rechazo), validación biométrica y cambio de
 * estado limitado a las transiciones permitidas.
 * @param {Object} props.application
 * @param {'CREDITO'|'INVERSION'} props.tipo
 * @param {Function} props.onUpdated - Recarga la solicitud tras un cambio
 */
export default function AdvisorReviewPanel({ application, tipo, onUpdated }) {
  const isClosed = CLOSED_STATUSES.includes(application.estado);
  const nextStates = STATUS_TRANSITIONS[application.estado] || [];

  const [estado, setEstado] = useState('');
  const [observacion, setObservacion] = useState(application.observacionAsesor || '');
  const [biometria, setBiometria] = useState(Boolean(application.biometriaValidada));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState(null);

  const validatedTypes = new Set(
    (application.documents || []).filter((doc) => doc.estado === 'VALIDADO').map((doc) => doc.tipo)
  );
  const requiredDocuments = requiredDocumentsFor(application);
  const missingDocuments = requiredDocuments.filter((doc) => !validatedTypes.has(doc.tipo));
  const noteRequired = STATUSES_REQUIRING_NOTE.includes(estado);

  const updateDocument = async (docId, body) => {
    setError(null);
    try {
      await adminService.updateDocumentStatus(docId, body);
      onUpdated();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const confirmReject = async () => {
    if (rejectReason.trim().length < 5) {
      setRejectError('Explica al cliente por qué se rechaza el documento.');
      return;
    }
    const ok = await updateDocument(rejecting.id, { estado: 'RECHAZADO', comentarioRevision: rejectReason.trim() });
    if (ok) {
      setRejecting(null);
      setRejectReason('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (noteRequired && !observacion.trim()) {
      setError('Escribe una observación para el cliente explicando el motivo.');
      return;
    }
    setSaving(true);
    try {
      await adminService.updateApplicationStatus(application.id, {
        tipo,
        ...(estado ? { estado } : {}),
        observacionAsesor: observacion,
        biometriaValidada: biometria,
      });
      setSuccess('Solicitud actualizada.');
      setEstado('');
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-space-md">
      <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-primary">Documentos</h2>
          <span className="text-[12px] text-gray-500">
            {requiredDocuments.length - missingDocuments.length} de {requiredDocuments.length} validados
          </span>
        </div>
        {!application.documents?.length ? (
          <p className="py-4 text-center text-[13px] text-gray-500">El cliente aún no ha subido documentos.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {application.documents.map((doc) => {
              const status = DOCUMENT_STATUS[doc.estado];
              return (
                <li key={doc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-primary">{DOCUMENT_LABELS[doc.tipo] || 'Otro documento'}</span>
                      <Badge variant={status?.variant} size="sm">{status?.label || doc.estado}</Badge>
                    </div>
                    <span className="block text-[12px] text-gray-500 truncate">{doc.nombreArchivo}</span>
                    {doc.estado === 'RECHAZADO' && doc.comentarioRevision && (
                      <span className="block text-[12px] text-red-700">Motivo: {doc.comentarioRevision}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={clientService.getDocumentUrl(doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] text-secondary hover:underline"
                    >
                      Ver archivo
                    </a>
                    {!isClosed && doc.estado !== 'VALIDADO' && (
                      <Button size="sm" variant="success" onClick={() => updateDocument(doc.id, { estado: 'VALIDADO', comentarioRevision: 'Documento verificado.' })}>
                        Validar
                      </Button>
                    )}
                    {!isClosed && doc.estado !== 'RECHAZADO' && (
                      <Button size="sm" variant="destructive" onClick={() => { setRejecting(doc); setRejectReason(''); setRejectError(null); }}>
                        Rechazar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-primary">Resolución</h2>
          <Badge variant={application.estado} size="lg">{STATUS_LABELS[application.estado] || application.estado}</Badge>
        </div>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {isClosed ? (
          <Alert type="info">La solicitud ya fue resuelta y no admite cambios.</Alert>
        ) : (
          <>
            <div className="space-y-1.5">
              <label htmlFor="estado-select" className="block text-[13px] font-medium text-primary">Cambiar estado a</label>
              <select
                id="estado-select"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-gray-200 bg-gray-50 text-[14px]"
              >
                <option value="">Mantener: {STATUS_LABELS[application.estado]}</option>
                {nextStates.map((state) => (
                  <option key={state} value={state}>{STATUS_LABELS[state]}</option>
                ))}
              </select>
              {estado === 'APROBADA' && missingDocuments.length > 0 && (
                <p className="text-[12px] text-amber-700">
                  Faltan documentos validados: {missingDocuments.map((doc) => doc.label.toLowerCase()).join(', ')}.
                </p>
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg bg-surface-container-low border border-surface-container-high">
              <input type="checkbox" checked={biometria} onChange={(e) => setBiometria(e.target.checked)} className="h-4 w-4 mt-0.5 accent-secondary" />
              <span className="text-[13px]">
                <strong className="text-primary">Validación biométrica aprobada</strong>
                <span className="block text-[12px] text-gray-500">La selfie corresponde a la persona de la cédula (simulado).</span>
              </span>
            </label>

            <div className="space-y-1.5">
              <label htmlFor="observacion-input" className="block text-[13px] font-medium text-primary">
                Observación para el cliente {noteRequired && <span className="text-error">*</span>}
              </label>
              <textarea
                id="observacion-input"
                rows={3}
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder={noteRequired ? 'Explica qué debe corregir o por qué no se aprueba.' : 'Opcional'}
                className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 text-[13px]"
              />
            </div>

            <Button type="submit" variant="fintech" className="w-full" loading={saving} loadingText="Guardando..." iconName="save">
              Guardar
            </Button>
          </>
        )}
      </form>

      <Modal isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Rechazar documento" maxWidth="max-w-md">
        <div className="space-y-3">
          <p className="text-[13px] text-gray-600">
            {rejecting && (DOCUMENT_LABELS[rejecting.tipo] || 'Documento')}: el cliente verá este motivo para volver a subirlo.
          </p>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => { setRejectReason(e.target.value); setRejectError(null); }}
            placeholder="Ej: la imagen está borrosa, sube una foto legible de ambos lados."
            className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 text-[13px]"
          />
          {rejectError && <p className="text-[12px] text-error">{rejectError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmReject}>Rechazar documento</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
