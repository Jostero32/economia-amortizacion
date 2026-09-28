import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { identityService } from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';
import CardCapture from '../../components/identity/CardCapture';
import SelfieCapture from '../../components/identity/SelfieCapture';
import { safeReturnPath, useIdentityStatus } from '../../components/identity/identityStatus';

const STEPS = [
  { key: 'anverso', label: 'Anverso de la cédula', icon: 'badge' },
  { key: 'reverso', label: 'Reverso de la cédula', icon: 'flip' },
  { key: 'selfie', label: 'Selfie', icon: 'face' },
];

// Autorización para tratar datos personales y biométricos (LOPDP): qué, para qué, cómo y cuánto tiempo
const CONSENT_POINTS = [
  ['Qué datos', 'Las fotos de tu cédula (anverso y reverso), una selfie y los datos impresos en la cédula.'],
  ['Para qué', 'Únicamente para verificar que eres el titular de la cédula antes de solicitar un crédito o una inversión.'],
  ['Cómo', 'El análisis lo hace el sistema de FinanEcuador; tus fotos no se envían a servicios externos. Si el resultado no es concluyente, un asesor las revisa.'],
  ['Cuánto tiempo', 'Mientras mantengas una relación con la institución o lo exija la ley.'],
  ['Tus derechos', 'Puedes pedir el acceso, la rectificación o la eliminación de tus datos personales.'],
];

const RESULTS = {
  APROBADA: { type: 'success', title: '¡Listo! Tu identidad quedó verificada', icon: 'verified_user' },
  EN_REVISION: { type: 'info', title: 'Recibimos tu verificación', icon: 'hourglass_top' },
  REINTENTAR: { type: 'warning', title: 'No pudimos verificar tu identidad', icon: 'replay' },
  RECHAZADA: { type: 'error', title: 'No pudimos verificar tu identidad', icon: 'gpp_bad' },
};

function Stepper({ step }) {
  const index = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="grid grid-cols-3 gap-2">
      {STEPS.map((s, i) => (
        <li
          key={s.key}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] sm:text-[13px] ${
            i === index ? 'border-secondary bg-blue-50 text-primary font-semibold' : i < index ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-100 text-gray-400'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">{i < index ? 'check_circle' : s.icon}</span>
          <span className="truncate">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function Controls({ controles }) {
  if (!controles?.length) return null;
  return (
    <ul className="space-y-1.5">
      {controles.map((c) => (
        <li key={c.codigo} className="flex items-start gap-2 text-[13px]">
          <span className={`material-symbols-outlined text-[18px] ${c.ok ? 'text-emerald-600' : c.ok === false ? 'text-rose-600' : 'text-gray-400'}`}>
            {c.ok ? 'check_circle' : c.ok === false ? 'cancel' : 'help'}
          </span>
          <span>{c.detalle}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ClientIdentityVerification() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const volver = safeReturnPath(params.get('volver'));
  const bienvenida = params.get('bienvenida') === '1';
  const { status, loading, error: loadError, reload } = useIdentityStatus();

  const [step, setStep] = useState('intro');
  const [verificationId, setVerificationId] = useState(null);
  const [consent, setConsent] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [result, setResult] = useState(null);

  if (loading) return <LoadingState message="Consultando tu verificación de identidad..." />;

  const current = status?.verification;
  const continueLabel = volver ? 'Continuar con mi solicitud' : 'Ir a mi resumen';
  const goOn = () => navigate(volver || '/cliente');

  const begin = async () => {
    if (!consent) {
      setError('Para continuar, autoriza el tratamiento de tus datos.');
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const response = await identityService.start(status.consentimientoVersion);
      setVerificationId(response.data.verification.id);
      setWarning(null);
      setStep('anverso');
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  // Cada captura se analiza en el servidor; si falla, CardCapture muestra el motivo y se repite
  const onFront = async (file) => {
    await identityService.uploadFront(verificationId, file);
    setStep('reverso');
  };
  const onBack = async (file) => {
    const response = await identityService.uploadBack(verificationId, file);
    setWarning(response.data.advertencia);
    setStep('selfie');
  };
  const onSelfie = async (file) => {
    const response = await identityService.uploadSelfie(verificationId, file);
    setResult(response.data);
    setStep('resultado');
    reload();
  };

  const header = (
    <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs">
      <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">Verificación de identidad</h1>
      <p className="text-[13px] text-on-surface-variant mt-0.5">
        Confirmamos que eres el titular de tu cédula. Se hace una sola vez.
      </p>
    </div>
  );

  // Ya verificada o en revisión: no hay nada que capturar
  if (step === 'intro' && (status?.verificada || current?.estado === 'EN_REVISION')) {
    const verified = status.verificada;
    return (
      <div className="space-y-space-md max-w-3xl mx-auto">
        {header}
        <Card>
          <div className="space-y-4 text-center py-4">
            <span className={`material-symbols-outlined text-[48px] ${verified ? 'text-emerald-600' : 'text-blue-600'}`}>
              {verified ? 'verified_user' : 'hourglass_top'}
            </span>
            <h2 className="text-[18px] font-bold text-primary">
              {verified ? 'Tu identidad está verificada' : 'Tu verificación está en revisión'}
            </h2>
            <p className="text-[13px] text-gray-600 max-w-md mx-auto">
              {verified
                ? 'Ya puedes solicitar créditos e inversiones.'
                : 'Un asesor la revisará pronto. Mientras tanto ya puedes enviar tus solicitudes; se aprobarán cuando confirme tu identidad.'}
            </p>
            <Button variant="fintech" iconName="arrow_forward" onClick={goOn}>{continueLabel}</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="space-y-space-md max-w-3xl mx-auto">
        {header}
        {bienvenida && (
          <Alert type="success" title="¡Tu cuenta está lista!">
            Verifica tu identidad ahora para poder solicitar créditos e inversiones, o hazlo más tarde desde tu resumen.
          </Alert>
        )}
        {loadError && <Alert type="error">{loadError}</Alert>}
        {current?.estado === 'RECHAZADA' && (
          <Alert type="error" title="Tu verificación anterior no fue aprobada">
            {current.comentarioRevision || current.motivos?.join(' ') || 'Puedes intentarlo de nuevo.'}
          </Alert>
        )}
        {current?.estado === 'EN_CURSO' && current.intentos > 0 && (
          <Alert type="warning" title={`Te quedan ${current.intentosRestantes} intento(s)`}>
            {current.motivos?.join(' ')}
          </Alert>
        )}

        <Card title="Qué vamos a pedirte" iconName="checklist">
          <div className="space-y-4">
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STEPS.map((s, i) => (
                <li key={s.key} className="rounded-lg bg-surface-container-low p-3 text-[13px]">
                  <span className="material-symbols-outlined text-secondary">{s.icon}</span>
                  <strong className="block text-primary">{i + 1}. {s.label}</strong>
                  <span className="text-gray-600">
                    {s.key === 'anverso' && 'El lado con tu foto.'}
                    {s.key === 'reverso' && 'El lado con las 3 líneas de letras y números.'}
                    {s.key === 'selfie' && 'Una foto de tu rostro, mirando de frente.'}
                  </span>
                </li>
              ))}
            </ol>
            <ul className="text-[13px] text-gray-600 space-y-1 list-disc pl-5">
              <li>Busca un lugar con buena luz y evita reflejos sobre la cédula.</li>
              <li>Funciona mejor con la cámara del celular; en una laptop, acerca bien la cédula.</li>
              <li>La foto se toma sola cuando la imagen está lista; también puedes tomarla con el botón.</li>
            </ul>
          </div>
        </Card>

        <Card title="Autorización de tratamiento de datos" iconName="privacy_tip">
          <div className="space-y-3">
            <dl className="space-y-2 text-[13px] max-h-56 overflow-y-auto pr-1">
              {CONSENT_POINTS.map(([term, description]) => (
                <div key={term}>
                  <dt className="font-semibold text-primary">{term}</dt>
                  <dd className="text-gray-600">{description}</dd>
                </div>
              ))}
            </dl>
            <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-gray-200 text-[13px]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => { setConsent(e.target.checked); setError(null); }}
                className="h-4 w-4 mt-0.5 accent-secondary"
              />
              <span className="text-gray-700">
                Autorizo a FinanEcuador a tratar mis datos personales y mi imagen facial (dato biométrico) para verificar mi identidad, en los términos descritos.
              </span>
            </label>
            {error && <Alert type="error">{error}</Alert>}
            <div className="flex flex-wrap justify-between gap-2">
              <Link to={volver || '/cliente'}>
                <Button variant="outline">{bienvenida ? 'Hacerlo más tarde' : 'Cancelar'}</Button>
              </Link>
              <Button variant="fintech" iconName="arrow_forward" onClick={begin} loading={starting} loadingText="Iniciando..." disabled={!consent}>
                Comenzar
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'resultado' && result) {
    const view = RESULTS[result.resultado];
    const { verification } = result;
    return (
      <div className="space-y-space-md max-w-3xl mx-auto">
        {header}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-[36px] ${
                { success: 'text-emerald-600', info: 'text-blue-600', warning: 'text-amber-600', error: 'text-rose-600' }[view.type]
              }`}>{view.icon}</span>
              <h2 className="text-[18px] font-bold text-primary">{view.title}</h2>
            </div>
            {result.resultado === 'EN_REVISION' && (
              <p className="text-[13px] text-gray-600">
                Un asesor revisará tu verificación. Mientras tanto ya puedes enviar tus solicitudes; se aprobarán cuando confirme tu identidad.
              </p>
            )}
            {verification.motivos?.length > 0 && (
              <Alert type={view.type === 'success' ? 'info' : view.type}>
                <ul className="list-disc pl-4 space-y-0.5">
                  {verification.motivos.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </Alert>
            )}
            <Controls controles={verification.controles} />
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {result.resultado === 'REINTENTAR' && (
                <>
                  <span className="self-center text-[12px] text-gray-500 mr-auto">
                    Te quedan {verification.intentosRestantes} intento(s).
                  </span>
                  <Button variant="fintech" iconName="replay" onClick={() => { setResult(null); setWarning(null); setStep('anverso'); }}>
                    Intentar de nuevo
                  </Button>
                </>
              )}
              {['APROBADA', 'EN_REVISION'].includes(result.resultado) && (
                <Button variant="fintech" iconName="arrow_forward" onClick={goOn}>{continueLabel}</Button>
              )}
              {result.resultado === 'RECHAZADA' && (
                <Button variant="outline" onClick={() => navigate('/cliente')}>Volver a mi resumen</Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const stepInfo = STEPS.find((s) => s.key === step);
  return (
    <div className="space-y-space-md max-w-3xl mx-auto">
      {header}
      <Stepper step={step} />
      <Card title={stepInfo.label} iconName={stepInfo.icon}>
        {step === 'selfie' && warning && <Alert type="warning" className="mb-3">{warning}</Alert>}
        {step === 'anverso' && <CardCapture key="anverso" lado="anverso" onConfirm={onFront} />}
        {step === 'reverso' && <CardCapture key="reverso" lado="reverso" onConfirm={onBack} />}
        {step === 'selfie' && <SelfieCapture onConfirm={onSelfie} />}
      </Card>
      <div className="text-center">
        <Link to={volver || '/cliente'} className="text-[12px] text-gray-500 hover:underline">
          Salir y continuar más tarde
        </Link>
      </div>
    </div>
  );
}
