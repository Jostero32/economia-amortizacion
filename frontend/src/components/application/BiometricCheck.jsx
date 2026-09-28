import React, { useEffect, useState } from 'react';
import { adminService, clientService } from '../../services/api';
import Button from '../Button';
import Alert from '../Alert';
import { compareDescriptors, detectMainFace, MATCH_DISTANCE, DOUBTFUL_DISTANCE } from '../../utils/faceMatch';

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const RESULT_STYLES = {
  COINCIDE: { label: 'Coincide', className: 'bg-emerald-50 border-emerald-200 text-emerald-900', bar: 'bg-emerald-500' },
  DUDOSO: { label: 'Dudoso: revisa manualmente', className: 'bg-amber-50 border-amber-200 text-amber-900', bar: 'bg-amber-500' },
  NO_COINCIDE: { label: 'No coincide', className: 'bg-rose-50 border-rose-200 text-rose-900', bar: 'bg-rose-500' },
};

// Documentos de un tipo que se pueden analizar, del más reciente al más antiguo
function imageCandidates(documents = [], tipo) {
  return documents
    .filter((doc) => doc.tipo === tipo && doc.estado !== 'RECHAZADO' && IMAGE_MIMES.includes(doc.mimeType))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Primer documento (más reciente) en el que se detecta un rostro
async function firstFace(candidates) {
  for (const doc of candidates) {
    const blob = await clientService.getDocumentBlob(doc.id);
    const face = await detectMainFace(blob);
    if (face) return { doc, blob, face };
  }
  return null;
}

/**
 * Reconocimiento facial asistido: compara el rostro de la cédula con el de la selfie en el
 * navegador del asesor y registra el resultado. La decisión final sigue siendo del asesor.
 * @param {Object} props.application
 * @param {'CREDITO'|'INVERSION'} props.tipo
 * @param {boolean} props.readOnly - Solicitud resuelta: solo muestra el último resultado
 * @param {Function} props.onResult - Recibe { similitud, distancia, resultado } tras comparar
 */
export default function BiometricCheck({ application, tipo, readOnly, onResult }) {
  const cedulas = imageCandidates(application.documents, 'CEDULA');
  const selfies = imageCandidates(application.documents, 'SELFIE');

  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [previews, setPreviews] = useState(null); // { cedula, selfie } object URLs
  const [result, setResult] = useState(
    application.biometriaResultado
      ? {
        similitud: Number(application.biometriaSimilitud),
        distancia: Number(application.biometriaDistancia),
        resultado: application.biometriaResultado,
      }
      : null
  );

  useEffect(() => () => {
    if (previews) {
      URL.revokeObjectURL(previews.cedula);
      URL.revokeObjectURL(previews.selfie);
    }
  }, [previews]);

  const compare = async () => {
    setError(null);
    try {
      setStatus('Cargando modelos de reconocimiento facial...');
      const selfie = await firstFace(selfies);
      if (!selfie) {
        setError('No se detectó un rostro en la selfie. Pide al cliente que la tome de nuevo con buena luz.');
        return;
      }
      setStatus('Buscando el rostro en la cédula...');
      const cedula = await firstFace(cedulas);
      if (!cedula) {
        setError('No se detectó un rostro en la cédula. Pide al cliente una foto nítida del anverso.');
        return;
      }
      setPreviews({ cedula: URL.createObjectURL(cedula.blob), selfie: URL.createObjectURL(selfie.blob) });

      const comparison = compareDescriptors(cedula.face.descriptor, selfie.face.descriptor);
      setResult(comparison);
      onResult?.(comparison);
      setStatus('Guardando resultado...');
      await adminService.recordBiometricCheck(application.id, { tipo, ...comparison });
    } catch (err) {
      setError(err?.message || 'No se pudo completar la comparación facial.');
    } finally {
      setStatus(null);
    }
  };

  const style = result && RESULT_STYLES[result.resultado];
  const missing = [!cedulas.length && 'la cédula', !selfies.length && 'la selfie'].filter(Boolean);

  return (
    <div className="p-3 rounded-lg border border-surface-container-high bg-surface-container-low space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13px] text-primary">Reconocimiento facial</strong>
          <span className="block text-[12px] text-gray-500">Compara el rostro de la cédula con el de la selfie.</span>
        </div>
        {!readOnly && missing.length === 0 && (
          <Button size="sm" variant="fintech" iconName="face" onClick={compare} loading={Boolean(status)} loadingText="Analizando..." className="whitespace-nowrap">
            {result ? 'Comparar de nuevo' : 'Comparar rostros'}
          </Button>
        )}
      </div>

      {!readOnly && missing.length > 0 && (
        <p className="text-[12px] text-amber-700">Falta {missing.join(' y ')} en formato de imagen para comparar.</p>
      )}
      {status && <p className="text-[12px] text-gray-500">{status} La primera vez puede tardar unos segundos.</p>}
      {error && <Alert type="error">{error}</Alert>}

      {previews && (
        <div className="grid grid-cols-2 gap-2">
          {[['Cédula', previews.cedula], ['Selfie', previews.selfie]].map(([label, url]) => (
            <figure key={label} className="space-y-1">
              <img src={url} alt={label} className="w-full h-32 object-contain bg-white rounded border border-gray-100" />
              <figcaption className="text-[11px] text-center text-gray-500">{label}</figcaption>
            </figure>
          ))}
        </div>
      )}

      {result && style && (
        <div className={`p-3 rounded-lg border ${style.className}`}>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-bold">{style.label}</span>
            <span className="text-[20px] font-bold" title="Nivel de coincidencia calculado a partir de la distancia">
              {result.similitud.toFixed(1)} %
            </span>
          </div>
          <div className="h-1.5 mt-1.5 rounded-full bg-white/70 overflow-hidden">
            <div className={`h-full ${style.bar}`} style={{ width: `${Math.min(100, result.similitud)}%` }} />
          </div>
          <span className="block mt-1.5 text-[11px] opacity-80">
            Distancia entre rostros {result.distancia.toFixed(3)} (coincide si ≤ {MATCH_DISTANCE}, dudoso hasta {DOUBTFUL_DISTANCE}).
          </span>
        </div>
      )}
    </div>
  );
}
