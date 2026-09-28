import React, { useCallback, useEffect, useRef, useState } from 'react';
import Button from '../Button';
import Alert from '../Alert';
import { useCamera } from './useCamera';
import { brightness, canvasToFile, grabFrame, lightingProblem, scaled, visibleRegion } from './captureQuality';
import { detectFaceInCanvas, preloadFaceModels } from '../../utils/faceMatch';
import { CHALLENGE_LABELS, DEFAULT_THRESHOLDS, checkChallenge, faceMetrics } from './liveness';

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
 * Selfie frontal y dos movimientos con captura automática. Los archivos subidos van al asesor.
 * @param {Function} props.onConfirm - Recibe la selfie y los fotogramas ordenados de los retos
 */
export default function SelfieCapture({ onConfirm, retos = [], umbrales = DEFAULT_THRESHOLDS }) {
  const [photo, setPhoto] = useState(null); // { file, url }
  const [frames, setFrames] = useState([]);
  const [phase, setPhase] = useState('frente');
  const [reference, setReference] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState('Preparando la cámara…');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const preview = phase === 'preview';
  const camera = useCamera({ facingMode: 'user', active: !preview });
  const streak = useRef(0);
  const analyzing = useRef(false);
  const fileInput = useRef(null);
  const viewer = useRef(null);
  const generation = useRef(0);
  const reto = retos[frames.length];

  // Lo que se ve en el visor, en pixeles del video
  const visibleFrame = () => grabFrame(camera.videoRef.current, visibleRegion(camera.videoRef.current, viewer.current));

  useEffect(() => { preloadFaceModels().catch(() => {}); }, []);
  useEffect(() => () => { generation.current += 1; }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const accept = useCallback(async (canvas, metrics) => {
    const current = generation.current;
    const file = await canvasToFile(canvas, 'selfie');
    if (current !== generation.current) return;
    setPhoto({ file, url: URL.createObjectURL(file) });
    setReference(metrics);
    setPhase(retos.length ? 'reto' : 'preview');
  }, [retos.length]);

  useEffect(() => {
    if (preview || timedOut || !camera.size) return undefined;
    let cancelled = false;
    const current = generation.current;
    const deadline = phase === 'reto' ? Date.now() + 15000 : Infinity;
    streak.current = 0;
    setStatus(phase === 'reto' ? 'Haz el movimiento y mantenlo un instante.' : 'Ubica tu rostro dentro del óvalo.');
    const timeout = phase === 'reto' ? setTimeout(() => setTimedOut(true), 15000) : null;
    const timer = setInterval(async () => {
      const video = camera.videoRef.current;
      if (analyzing.current || !video || video.readyState < 2 || !viewer.current) return;
      analyzing.current = true;
      try {
        const frame = visibleFrame();
        const small = scaled(frame, 480);
        const face = await detectFaceInCanvas(small, { allowMargin: true });
        if (cancelled || current !== generation.current || Date.now() >= deadline) return;
        const metrics = faceMetrics(face?.landmarks);
        const problem = lightingProblem(brightness(small)) || (phase === 'frente' ? faceProblem(face)
          : !face || face.faces !== 1 ? 'Que solo aparezca tu rostro en la cámara.' : null);
        if (problem) {
          streak.current = 0;
          setStatus(problem);
        } else if (metrics && (phase === 'frente' || checkChallenge(reto, reference, metrics, umbrales))) {
          streak.current += 1;
          setStatus('¡Perfecto! No te muevas…');
          if (streak.current >= 2) {
            streak.current = 0;
            if (phase === 'frente') await accept(frame, metrics);
            else {
              const file = await canvasToFile(frame, `vida-${frames.length + 1}`);
              if (cancelled || current !== generation.current || Date.now() >= deadline) return;
              clearTimeout(timeout);
              setFrames((previous) => [...previous, file]);
              if (frames.length + 1 === retos.length) setPhase('preview');
            }
          }
        } else {
          streak.current = 0;
          setStatus(phase === 'reto' ? 'Haz el movimiento un poco más y mantenlo.' : 'Mira de frente para comenzar.');
        }
      } catch {
        // el siguiente cuadro vuelve a intentarlo
      } finally {
        analyzing.current = false;
      }
    }, 450);
    return () => { cancelled = true; clearInterval(timer); clearTimeout(timeout); };
  }, [preview, phase, timedOut, retry, frames.length, retos.length, reto, reference, umbrales, camera.size, camera.videoRef, accept]);

  const captureNow = async () => {
    if (!camera.videoRef.current?.videoWidth || !viewer.current || analyzing.current) return;
    analyzing.current = true;
    const current = ++generation.current;
    try {
      const frame = visibleFrame();
      const face = await detectFaceInCanvas(scaled(frame, 480), { allowMargin: true });
      if (current !== generation.current) return;
      const metrics = faceMetrics(face?.landmarks);
      if (!metrics || face.faces !== 1) setError('Necesitamos ver solo tu rostro de frente para comenzar los movimientos.');
      else { setError(null); await accept(frame, metrics); }
    } catch {
      setError('No pudimos preparar la selfie. Intenta de nuevo o sube una foto para revisión.');
    } finally {
      analyzing.current = false;
      setRetry((n) => n + 1);
    }
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
    generation.current += 1;
    setFrames([]);
    setReference(null);
    setTimedOut(false);
    setPhoto({ file, url: URL.createObjectURL(file) });
    setPhase('preview');
  };

  const restart = () => {
    generation.current += 1;
    setPhoto(null);
    setFrames([]);
    setReference(null);
    setError(null);
    setTimedOut(false);
    setPhase('frente');
  };

  const confirm = async () => {
    setSending(true);
    setError(null);
    try {
      await onConfirm(photo.file, frames);
    } catch (err) {
      setError(err.message || 'No pudimos analizar tu selfie. Intenta nuevamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-gray-600">
        Mira de frente a la cámara, sin gafas oscuras ni gorra, en un lugar con buena luz.
      </p>

      {phase === 'reto' && (
        <div className="text-center text-primary space-y-1" aria-live="polite">
          <span className="material-symbols-outlined text-[36px]" aria-hidden="true">
            {reto === 'SONRISA' ? 'sentiment_satisfied' : reto === 'GIRO_IZQUIERDA' ? 'arrow_back' : 'arrow_forward'}
          </span>
          <h3 className="text-xl font-bold">{CHALLENGE_LABELS[reto]}</h3>
          <p className="text-[13px]">Movimiento {frames.length + 1} de {retos.length}. Tienes 15 segundos.</p>
        </div>
      )}

      {preview ? (
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
      {!preview && camera.error && <Alert type="warning">{camera.error}</Alert>}
      {preview && !frames.length && <Alert type="info">Sin prueba de vida, un asesor revisará tu verificación.</Alert>}
      {timedOut && <Alert type="warning">No detectamos el movimiento. Mira de frente y repítelo cuando estés listo.</Alert>}
      {!preview && !camera.error && !timedOut && (
        <p className="text-[13px] font-medium text-primary text-center" aria-live="polite">{status}</p>
      )}

      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
      <div className="flex flex-wrap justify-end gap-2">
        {preview ? (
          <>
            <Button variant="outline" iconName="replay" onClick={restart} disabled={sending}>
              Repetir
            </Button>
            <Button variant="fintech" iconName="check" onClick={confirm} loading={sending} loadingText="Verificando...">
              Usar esta selfie
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" iconName="upload" onClick={() => fileInput.current?.click()}>Subir foto para revisión</Button>
            {phase === 'frente' && (
              <Button variant="secondary" iconName="photo_camera" onClick={captureNow} disabled={!camera.size}>Tomar selfie</Button>
            )}
            {timedOut && (
              <Button variant="secondary" iconName="replay" onClick={() => { setTimedOut(false); setRetry((n) => n + 1); }}>Repetir movimiento</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
