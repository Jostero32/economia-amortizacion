import React, { useCallback, useEffect, useRef, useState } from 'react';
import Button from '../Button';
import Alert from '../Alert';
import { useCamera } from './useCamera';
import {
  CARD_RATIO,
  MIN_BACK_SHARPNESS,
  MIN_FRONT_SHARPNESS,
  brightness,
  canvasToFile,
  grabFrame,
  lightingProblem,
  scaled,
  sharpness,
  visibleRegion,
} from './captureQuality';
import { detectFaceInCanvas, preloadFaceModels } from '../../utils/faceMatch';

const SIDES = {
  anverso: {
    hint: 'El lado con tu foto. Ubica la cédula dentro del marco, sin reflejos sobre la foto.',
    zone: { from: 0.15, to: 0.95 },
    minSharpness: MIN_FRONT_SHARPNESS,
  },
  reverso: {
    hint: 'El lado con las 3 líneas de letras y números de la parte inferior. Que esas líneas se vean nítidas.',
    zone: { from: 0.62, to: 0.97 },
    minSharpness: MIN_BACK_SHARPNESS,
  },
};

// Visor 4:3 con el marco de la tarjeta centrado y lo más grande posible (fracciones del visor)
const VIEWER_RATIO = 4 / 3;
const CARD_FRAME = (() => {
  const width = Math.min(0.86, (0.86 * CARD_RATIO) / VIEWER_RATIO);
  const height = (width * VIEWER_RATIO) / CARD_RATIO;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
})();

function CardGuide({ lado }) {
  const pct = (value) => `${value * 100}%`;
  return (
    <div
      className="absolute rounded-[4%] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
      style={{ left: pct(CARD_FRAME.x), top: pct(CARD_FRAME.y), width: pct(CARD_FRAME.width), height: pct(CARD_FRAME.height) }}
    >
      {lado === 'anverso' ? (
        <div className="absolute border-2 border-dashed border-white/70 rounded-md flex items-end justify-center" style={{ left: '5%', top: '22%', width: '28%', height: '63%' }}>
          <span className="text-[10px] text-white/90 mb-1">Tu foto</span>
        </div>
      ) : (
        <div className="absolute border-2 border-dashed border-white/70 rounded flex items-center justify-center" style={{ left: '4%', right: '4%', top: '62%', height: '33%' }}>
          <span className="text-[10px] sm:text-[11px] text-white/90 font-mono tracking-wider">I&lt;ECU··· 3 líneas</span>
        </div>
      )}
    </div>
  );
}

/**
 * Foto de un lado de la cédula con marco guía. Captura sola cuando la imagen está lista dos
 * veces seguidas (luz, nitidez y, en el anverso, la foto del titular); también hay botón manual y
 * la opción de subir una foto.
 * @param {'anverso'|'reverso'} props.lado
 * @param {Function} props.onConfirm - Recibe el File; si lanza un error, se muestra y se repite la foto
 */
export default function CardCapture({ lado, onConfirm }) {
  const config = SIDES[lado];
  const [photo, setPhoto] = useState(null); // { file, url }
  const [status, setStatus] = useState('Preparando la cámara…');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const camera = useCamera({ facingMode: 'environment', active: !photo });
  const streak = useRef(0);
  const analyzing = useRef(false);
  const fileInput = useRef(null);
  const viewer = useRef(null);

  // Lo que se ve dentro del marco, en pixeles del video
  const cardFrame = () => grabFrame(camera.videoRef.current, visibleRegion(camera.videoRef.current, viewer.current, CARD_FRAME));

  useEffect(() => { preloadFaceModels().catch(() => {}); }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const accept = useCallback(async (canvas) => {
    const file = await canvasToFile(canvas, lado);
    setPhoto({ file, url: URL.createObjectURL(file) });
  }, [lado]);

  // Qué le falta al cuadro para capturarlo (null = listo)
  const problemOf = useCallback(async (frame) => {
    const light = lightingProblem(brightness(frame));
    if (light) return light;
    if (sharpness(frame, config.zone) < config.minSharpness) {
      return lado === 'reverso'
        ? 'Acerca la cédula y mantenla quieta: las líneas de abajo deben verse nítidas.'
        : 'Mantén la cédula quieta: la imagen está borrosa.';
    }
    if (lado === 'anverso' && !(await detectFaceInCanvas(scaled(frame, 640)))) {
      return 'No vemos la foto de tu cédula: muestra el lado de la foto, sin reflejos.';
    }
    return null;
  }, [config, lado]);

  // Análisis del video cada ~700 ms
  useEffect(() => {
    if (photo || !camera.size) return undefined;
    setStatus('Ubica la cédula dentro del marco.');
    const timer = setInterval(async () => {
      const video = camera.videoRef.current;
      if (analyzing.current || !video || video.readyState < 2 || !viewer.current) return;
      analyzing.current = true;
      try {
        const frame = cardFrame();
        const problem = await problemOf(frame);
        if (problem) {
          streak.current = 0;
          setStatus(problem);
        } else {
          streak.current += 1;
          setStatus('¡Bien! No te muevas…');
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
  }, [photo, camera.size, camera.videoRef, problemOf, accept]);

  const captureNow = async () => {
    if (camera.videoRef.current?.videoWidth && viewer.current) await accept(cardFrame());
  };

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
      setError(err.message || 'No pudimos recibir la foto. Intenta nuevamente.');
      setPhoto(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-gray-600">{config.hint}</p>

      {photo ? (
        <div className="relative w-full max-w-2xl mx-auto bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]">
          <img src={photo.url} alt={`Foto del ${lado} de la cédula`} className="max-h-[60vh] w-full object-contain" />
        </div>
      ) : (
        <div ref={viewer} className="relative w-full max-w-2xl mx-auto bg-gray-900 rounded-xl overflow-hidden" style={{ aspectRatio: '4 / 3' }}>
          <video
            ref={camera.attach}
            onLoadedMetadata={camera.onLoadedMetadata}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {camera.size && <CardGuide lado={lado} />}
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
            <Button variant="fintech" iconName="check" onClick={confirm} loading={sending} loadingText="Analizando...">
              Usar esta foto
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" iconName="upload" onClick={() => fileInput.current?.click()}>Subir una foto</Button>
            <Button variant="secondary" iconName="photo_camera" onClick={captureNow} disabled={!camera.size}>
              Tomar foto
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
