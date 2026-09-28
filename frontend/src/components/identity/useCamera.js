import { useCallback, useEffect, useRef, useState } from 'react';

export function cameraErrorMessage(error) {
  if (!window.isSecureContext) return 'La cámara solo funciona en una conexión segura (https).';
  if (error?.name === 'NotAllowedError') return 'No diste permiso para usar la cámara. Habilítalo en el navegador e intenta nuevamente.';
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
    return 'No encontramos una cámara en este dispositivo. Puedes subir una foto.';
  }
  if (error?.name === 'NotReadableError') return 'La cámara está siendo usada por otra aplicación. Ciérrala e intenta nuevamente.';
  return 'No se pudo abrir la cámara. Puedes subir una foto.';
}

/**
 * Cámara del dispositivo. Devuelve una ref de callback para el <video>: el elemento puede montarse
 * después de pedir la cámara (vista previa → repetir) y el stream se conecta al aparecer.
 * @param {Object} options
 * @param {'user'|'environment'} options.facingMode - Frontal para la selfie, trasera para la cédula
 * @param {boolean} options.active - Apaga la cámara cuando es false
 */
export function useCamera({ facingMode = 'user', active = true } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [size, setSize] = useState(null); // { width, height } del video cuando hay imagen

  const attach = useCallback((node) => {
    videoRef.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) node.srcObject = streamRef.current;
  }, []);

  const onLoadedMetadata = useCallback((event) => {
    const { videoWidth, videoHeight } = event.currentTarget;
    if (videoWidth && videoHeight) setSize({ width: videoWidth, height: videoHeight });
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('Sin cámara'), { name: 'NotFoundError' });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        // Se desmontó mientras el navegador pedía permiso: apagar la cámara
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        if (!cancelled) setError(cameraErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setSize(null);
    };
  }, [active, facingMode]);

  return { attach, videoRef, onLoadedMetadata, size, error };
}
