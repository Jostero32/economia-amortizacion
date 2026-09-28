import React, { useCallback, useEffect, useRef, useState } from 'react';
import Button from '../Button';
import Alert from '../Alert';
import { useCamera } from './useCamera';
import { brightness, canvasToFile, grabFrame, lightingProblem, scaled, visibleRegion } from './captureQuality';
import { detectFaceInCanvas, preloadFaceModels } from '../../utils/faceMatch';

// Visor vertical 3:4 con el óvalo guía (en fracciones del visor)
const VIEWER = { width: 300, height: 400 };
const OVAL = { cx: 0.5, cy: 0.47, rx: 0.34 };

/** Qué le falta al rostro para capturarlo (null = listo). */
function faceProblem(face) {
  if (!face) return 'Ubica tu rostro dentro del óvalo, mirando de frente.';
  if (face.faces > 1) return 'Que solo aparezcas tú en la cámara.';
  const cx = face.box.x + face.box.width / 2;
  const cy = face.box.y + face.box.height / 2;
  if (face.box.width < 0.28) return 'Acércate un poco a la cámara.';
  if (face.box.width > 0.8) return 'Aléjate un poco de la cámara.';
  if (Math.abs(cx - OVAL.cx) > 0.15 || Math.abs(cy - OVAL.cy) > 0.2) return 'Centra tu rostro dentro del óvalo.';
  return null;
}

function OvalGuide() {
  const { width: w, height: h } = VIEWER;
  const rx = w * OVAL.rx;
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <mask id="selfie-oval">
          <rect width={w} height={h} fill="white" />
          <ellipse cx={w * OVAL.cx} cy={h * OVAL.cy} rx={rx} ry={rx * 1.3} fill="black" />
        </mask>
      </defs>
      <rect width={w} height={h} fill="rgba(0,0,0,0.55)" mask="url(#selfie-oval)" />
      <ellipse cx={w * OVAL.cx} cy={h * OVAL.cy} rx={rx} ry={rx * 1.3} fill="none" stroke="white" strokeWidth="3" strokeDasharray="10 7" />
    </svg>
  );
}

/**
 * Selfie con la cámara frontal y óvalo guía. Captura sola cuando hay un único rostro centrado, a
 * buena distancia y con luz suficiente.
 * @param {Function} props.onConfirm - Recibe el File; si lanza un error, se muestra y se repite
 */
export default function SelfieCapture({ onConfirm }) {
  const [photo, setPhoto] = useState(null); // { file, url }
  const [status, setStatus] = useState('Preparando la cámara…');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const camera = useCamera({ facingMode: 'user', active: !photo });
  const streak = useRef(0);
  const analyzing = useRef(false);
  const fileInput = useRef(null);
  const viewer = useRef(null);

  // Lo que se ve en el visor, en pixeles del video
  const visibleFrame = () => grabFrame(camera.videoRef.current, visibleRegion(camera.videoRef.current, viewer.current));

  useEffect(() => { preloadFaceModels().catch(() => {}); }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const accept = useCallback(async (canvas) => {
    const file = await canvasToFile(canvas, 'selfie');
    setPhoto({ file, url: URL.createObjectURL(file) });
  }, []);

  useEffect(() => {
    if (photo || !camera.size) return undefined;
    setStatus('Ubica tu rostro dentro del óvalo.');
    const timer = setInterval(async () => {
      const video = camera.videoRef.current;
      if (analyzing.current || !video || video.readyState < 2 || !viewer.current) return;
      analyzing.current = true;
      try {
        const frame = visibleFrame();
        const small = scaled(frame, 480);
        const problem = lightingProblem(brightness(small)) || faceProblem(await detectFaceInCanvas(small));
        if (problem) {
          streak.current = 0;
          setStatus(problem);
        } else {
          streak.current += 1;
          setStatus('¡Perfecto! No te muevas…');
          if (streak.current >= 2) {
            streak.current = 0;
            await accept(frame);
          }
        }
      } catch {
        // el siguiente cuadro vuelve a intentarlo
      } finally {
        analyzing.current = false;
      }
    }, 700);
    return () => clearInterval(timer);
  }, [photo, camera.size, camera.videoRef, accept]);

  const captureNow = async () => {
    if (camera.videoRef.current?.videoWidth && viewer.current) await accept(visibleFrame());
  };

  // Sin cámara se puede subir una foto (sin prueba de vida, la revisará un asesor)
  const onFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('La foto debe ser una imagen JPG, PNG o WEBP.');
      return;
    }
    setError(null);
    setPhoto({ file, url: URL.createObjectURL(file) });
  };

  const confirm = async () => {
    setSending(true);
    setError(null);
    try {
      await onConfirm(photo.file);
    } catch (err) {
      setError(err.message || 'No pudimos analizar tu selfie. Intenta nuevamente.');
      setPhoto(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-gray-600">
        Mira de frente a la cámara, sin gafas oscuras ni gorra, en un lugar con buena luz.
      </p>

      {photo ? (
        <div className="relative w-full max-w-sm mx-auto bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]">
          <img src={photo.url} alt="Tu selfie" className="max-h-[60vh] w-full object-contain" />
        </div>
      ) : (
        <div ref={viewer} className="relative w-full max-w-sm mx-auto bg-gray-900 rounded-xl overflow-hidden" style={{ aspectRatio: '3 / 4' }}>
          {/* Vista en espejo, como la cámara frontal de un teléfono; la foto se guarda sin espejo */}
          <video
            ref={camera.attach}
            onLoadedMetadata={camera.onLoadedMetadata}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover -scale-x-100"
          />
          {camera.size && <OvalGuide />}
        </div>
      )}

      {error && <Alert type="error">{error}</Alert>}
      {!photo && camera.error && <Alert type="warning">{camera.error}</Alert>}
      {!photo && !camera.error && (
        <p className="text-[13px] font-medium text-primary text-center" aria-live="polite">{status}</p>
      )}

      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
      <div className="flex flex-wrap justify-end gap-2">
        {photo ? (
          <>
            <Button variant="outline" iconName="replay" onClick={() => { setPhoto(null); setError(null); }} disabled={sending}>
              Repetir
            </Button>
            <Button variant="fintech" iconName="check" onClick={confirm} loading={sending} loadingText="Verificando...">
              Usar esta selfie
            </Button>
          </>
        ) : (
          <>
            {camera.error && (
              <Button variant="ghost" iconName="upload" onClick={() => fileInput.current?.click()}>Subir una foto</Button>
            )}
            <Button variant="secondary" iconName="photo_camera" onClick={captureNow} disabled={!camera.size}>
              Tomar selfie
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
