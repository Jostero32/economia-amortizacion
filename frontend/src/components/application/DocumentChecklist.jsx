import React, { useState } from 'react';
import { clientService } from '../../services/api';
import Badge from '../Badge';
import Button from '../Button';
import Alert from '../Alert';
import SelfieCamera from './SelfieCamera';
import { CLOSED_STATUSES, DOCUMENT_STATUS, requiredDocumentsFor } from './applicationStatus';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// El asesor compara el rostro de la cédula con el de la selfie: ambas deben ser imágenes
const FACE_DOCUMENT_TYPES = ['CEDULA', 'SELFIE'];

function fileTypeError(file, docType) {
  if (FACE_DOCUMENT_TYPES.includes(docType) && !IMAGE_TYPES.includes(file.type)) {
    return 'La cédula y la selfie deben ser una foto JPG, PNG o WEBP (no PDF) para la validación biométrica.';
  }
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Solo se aceptan archivos PDF o imágenes JPG, PNG o WEBP.';
  return null;
}

// Último documento subido de cada tipo (si se volvió a subir, cuenta el más reciente)
function latestByType(documents = []) {
  const latest = {};
  documents.forEach((doc) => {
    const current = latest[doc.tipo];
    if (!current || new Date(doc.createdAt) > new Date(current.createdAt)) {
      latest[doc.tipo] = doc;
    }
  });
  return latest;
}

/**
 * Documentos requeridos de una solicitud: estado de cada uno y carga de archivos
 * @param {Object} props.application - Solicitud con sus documentos
 * @param {'creditApplicationId'|'investmentApplicationId'} props.applicationField
 * @param {Function} props.onUploaded - Se llama después de subir un documento
 */
export default function DocumentChecklist({ application, applicationField, onUploaded }) {
  const isClosed = CLOSED_STATUSES.includes(application.estado);
  const requiredDocuments = requiredDocumentsFor(application);
  const latest = latestByType(application.documents);
  const pendingTypes = requiredDocuments.filter(
    (doc) => !latest[doc.tipo] || latest[doc.tipo].estado === 'RECHAZADO'
  );

  const [docType, setDocType] = useState(pendingTypes[0]?.tipo || 'CEDULA');
  const [file, setFile] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const isSelfie = docType === 'SELFIE';
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setError(null);
    const typeError = selected && fileTypeError(selected, docType);
    if (typeError) {
      setError(typeError);
      setFile(null);
      event.target.value = '';
      return;
    }
    if (selected && selected.size > MAX_FILE_BYTES) {
      setError('El archivo pesa más de 5 MB. Reduce su tamaño e intenta nuevamente.');
      setFile(null);
      event.target.value = '';
      return;
    }
    setFile(selected);
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setError(isSelfie ? 'Toma la selfie con la cámara o selecciona una foto.' : 'Selecciona el archivo que quieres subir.');
      return;
    }
    const typeError = fileTypeError(file, docType);
    if (typeError) {
      setError(typeError);
      return;
    }
    if (isSelfie && !consent) {
      setError('Debes autorizar el tratamiento de tu imagen para la validación biométrica.');
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.append('archivo', file);
      body.append('tipo', docType);
      body.append(applicationField, application.id);
      if (isSelfie) body.append('consentimientoBiometrico', 'true');
      await clientService.uploadDocument(body);
      setSuccess('Documento recibido. Un asesor lo revisará.');
      setFile(null);
      setConsent(false);
      event.target.reset();
      onUploaded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const acceptedInput = FACE_DOCUMENT_TYPES.includes(docType)
    ? IMAGE_TYPES.join(',')
    : ACCEPTED_TYPES.join(',');

  const changeDocType = (value) => {
    setDocType(value);
    setError(null);
    if (file && fileTypeError(file, value)) setFile(null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-6 space-y-4">
      <div>
        <h2 className="text-[16px] font-bold text-primary">Documentos</h2>
        <p className="text-[13px] text-gray-500">
          {pendingTypes.length === 0
            ? 'Ya enviaste todos los documentos requeridos.'
            : `Te faltan ${pendingTypes.length} de ${requiredDocuments.length} documentos.`}
        </p>
      </div>

      <ul className="divide-y divide-gray-100">
        {requiredDocuments.map((required) => {
          const doc = latest[required.tipo];
          const status = doc ? DOCUMENT_STATUS[doc.estado] : null;
          return (
            <li key={required.tipo} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-[14px] font-medium text-primary">{required.label}</span>
                <span className="block text-[12px] text-gray-500">{required.hint}</span>
                {doc?.estado === 'RECHAZADO' && doc.comentarioRevision && (
                  <span className="block text-[12px] text-red-700 mt-1">Motivo: {doc.comentarioRevision}</span>
                )}
                {doc && (
                  <a
                    href={clientService.getDocumentUrl(doc.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-[12px] text-secondary hover:underline mt-1 truncate max-w-[240px]"
                  >
                    Ver {doc.nombreArchivo}
                  </a>
                )}
              </div>
              {status ? (
                <Badge variant={status.variant} size="sm">{status.label}</Badge>
              ) : (
                <Badge variant="default" size="sm">Falta</Badge>
              )}
            </li>
          );
        })}
      </ul>

      {isClosed ? (
        <Alert type="info">La solicitud ya fue resuelta; no es necesario subir más documentos.</Alert>
      ) : (
        <form onSubmit={handleUpload} className="space-y-3 pt-2 border-t border-gray-100">
          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
          <div className="space-y-1.5">
            <label htmlFor="doc-type" className="block text-[13px] font-medium text-primary">Documento</label>
            <select
              id="doc-type"
              value={docType}
              onChange={(e) => changeDocType(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-gray-200 bg-gray-50 text-[14px]"
            >
              {requiredDocuments.map((doc) => (
                <option key={doc.tipo} value={doc.tipo}>{doc.label}</option>
              ))}
              <option value="OTRO">Otro documento de respaldo</option>
            </select>
          </div>
          {isSelfie && (
            <div className="space-y-2">
              <Button variant="secondary" iconName="photo_camera" className="w-full" onClick={() => setCameraOpen(true)}>
                Tomar selfie con la cámara
              </Button>
              {file && file.name.startsWith('selfie-camara-') && (
                <p className="text-[12px] text-emerald-700">Selfie capturada y lista para enviar.</p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="doc-file" className="block text-[13px] font-medium text-primary">
              {FACE_DOCUMENT_TYPES.includes(docType)
                ? `${isSelfie ? 'O sube una foto' : 'Foto'} (JPG, PNG o WEBP, máximo 5 MB)`
                : 'Archivo (PDF o imagen, máximo 5 MB)'}
            </label>
            <input
              id="doc-file"
              type="file"
              accept={acceptedInput}
              onChange={handleFileChange}
              className="w-full text-[13px] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 file:text-primary border border-gray-200 rounded-lg p-1"
            />
          </div>
          {isSelfie && (
            <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg bg-surface-container-low border border-surface-container-high">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-4 w-4 mt-0.5 accent-secondary" />
              <span className="text-[12px] text-gray-600">
                Autorizo el tratamiento de mi imagen facial (dato biométrico, LOPDP) únicamente para verificar
                que soy el titular de la cédula en esta solicitud.
              </span>
            </label>
          )}
          <Button type="submit" variant="fintech" iconName="cloud_upload" loading={uploading} loadingText="Subiendo..." className="w-full">
            Subir documento
          </Button>
        </form>
      )}

      <SelfieCamera
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(captured) => { setFile(captured); setError(null); }}
      />
    </div>
  );
}
