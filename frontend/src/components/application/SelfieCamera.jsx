import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../Modal';
import Button from '../Button';
import Alert from '../Alert';
import { detectMainFace, preloadFaceModels } from '../../utils/faceMatch';

function cameraErrorMessage(error) {
  if (!window.isSecureContext) return 'La cámara solo funciona en una conexión segura (https).';
  if (error?.name === 'NotAllowedError') return 'No diste permiso para usar la cámara. Habilítalo en el navegador e intenta nuevamente.';
  if (error?.name === 'NotFoundError') return 'No encontramos una cámara en este dispositivo. Puedes subir la selfie como archivo.';
  if (error?.name === 'NotReadableError') return 'La cámara está siendo usada por otra aplicación. Ciérrala e intenta nuevamente.';
  return 'No se pudo abrir la cámara. Puedes subir la selfie como archivo.';
}

/**
 * Captura de la selfie con la cámara del dispositivo. Antes de entregar la foto comprueba que
 * haya un rostro visible, para que el asesor pueda compararlo con la cédula.
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onCapture - Recibe el File JPG capturado
 */
export default function SelfieCamera({ isOpen, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const openRef = useRef(isOpen);
  const [photo, setPhoto] = useState(null); // { blob, url }
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);
  const [faceOk, setFaceOk] = useState(false);

  // El <video> se vuelve a montar al repetir la foto: conectar el stream cuando aparezca
  const attachVideo = useCallback((node) => {
    videoRef.current = node;
    if (node && streamRef.current) node.srcObject = streamRef.current;
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      // El modal se cerró mientras el navegador pedía permiso: apagar la cámara
      if (!openRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setError(cameraErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    openRef.current = isOpen;
    if (!isOpen) return undefined;
    startCamera();
    // Los modelos se descargan mientras la persona se acomoda frente a la cámara
    preloadFaceModels().catch(() => {});
    return stopCamera;
  }, [isOpen, startCamera, stopCamera]);

  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);

  const handleClose = useCallback(() => {
    openRef.current = false;
    stopCamera();
    setPhoto(null);
    setFaceOk(false);
    setError(null);
    onClose();
  }, [onClose, stopCamera]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      setError('No se pudo capturar la foto. Intenta nuevamente.');
      return;
    }
    stopCamera();
    setPhoto({ blob, url: URL.createObjectURL(blob) });
    setFaceOk(false);
    setError(null);
    setChecking(true);
    try {
      const face = await detectMainFace(blob);
      if (face) setFaceOk(true);
      else setError('No detectamos tu rostro. Mira de frente a la cámara, con buena luz y sin gafas oscuras.');
    } catch {
      setError('No se pudo analizar la foto. Revisa tu conexión e intenta nuevamente.');
    } finally {
      setChecking(false);
    }
  };

  const retake = () => {
    setPhoto(null);
    setFaceOk(false);
    startCamera();
  };

  const accept = () => {
    const file = new File([photo.blob], `selfie-camara-${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Tomar selfie con tu cédula" maxWidth="max-w-lg">
      <div className="space-y-3">
        <p className="text-[13px] text-gray-600">
          Mira de frente a la cámara y sostén tu cédula junto al rostro, con la foto del documento visible.
        </p>

        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
          {photo ? (
            <img src={photo.url} alt="Selfie capturada" className="w-full h-full object-contain" />
          ) : (
            // Vista previa en espejo, como la cámara frontal de un teléfono; la foto se guarda sin espejo
            <video ref={attachVideo} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
          )}
        </div>

        {error && <Alert type="error">{error}</Alert>}
        {checking && <Alert type="info">Verificando que el rostro sea visible...</Alert>}
        {faceOk && <Alert type="success">Rostro detectado. Puedes usar esta foto.</Alert>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {photo ? (
            <>
              <Button variant="secondary" onClick={retake} disabled={checking}>Tomar otra</Button>
              <Button variant="fintech" onClick={accept} disabled={!faceOk}>Usar esta foto</Button>
            </>
          ) : (
            <Button variant="fintech" iconName="photo_camera" onClick={capture} disabled={Boolean(error)}>
              Capturar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
