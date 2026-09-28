import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../Button';
import { formatDate } from '../../utils/format';
import { verificationPath } from './identityStatus';

const TONES = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-950',
  info: 'bg-blue-50 border-blue-200 text-blue-950',
  warning: 'bg-amber-50 border-amber-200 text-amber-950',
  error: 'bg-rose-50 border-rose-200 text-rose-950',
};

/**
 * Estado de la verificación de identidad del cliente, con la acción que corresponde.
 * @param {Object} props.status - Respuesta de GET /identity/me
 * @param {string} [props.volver] - Ruta a la que volver después de verificarse
 * @param {boolean} [props.hideWhenVerified] - En el resumen no hace falta recordar que ya está verificado
 */
export default function IdentityStatusCard({ status, volver, hideWhenVerified = false }) {
  if (!status) return null;
  const { verification, verificada } = status;

  let tone = 'warning';
  let icon = 'badge';
  let title = 'Verifica tu identidad';
  let text = 'Es necesario para solicitar créditos e inversiones. Toma unos 2 minutos: fotos de tu cédula y una selfie.';
  let action = { label: 'Verificar ahora', icon: 'arrow_forward' };

  if (verificada) {
    if (hideWhenVerified) return null;
    tone = 'success';
    icon = 'verified_user';
    title = 'Identidad verificada';
    text = verification.aprobacionAutomatica
      ? `Verificada automáticamente el ${formatDate(verification.fechaVerificacion)}.`
      : 'Tu identidad está verificada.';
    if (verification.vigenteHasta) text += ` Vigente hasta el ${formatDate(verification.vigenteHasta)}.`;
    action = null;
  } else if (verification?.estado === 'EN_REVISION') {
    tone = 'info';
    icon = 'hourglass_top';
    title = 'Tu verificación está en revisión';
    text = 'Ya puedes enviar solicitudes; se aprobarán cuando un asesor confirme tu identidad.';
    action = null;
  } else if (verification?.estado === 'EN_CURSO') {
    title = 'Termina de verificar tu identidad';
    text = verification.intentos > 0
      ? `Te quedan ${verification.intentosRestantes} intento(s). ${verification.motivos?.[0] || ''}`
      : 'Empezaste la verificación pero aún no la terminas.';
    action = { label: 'Continuar', icon: 'arrow_forward' };
  } else if (verification?.estado === 'APROBADA') {
    title = 'Tu cédula verificada venció';
    text = 'Vuelve a verificar tu identidad con tu cédula vigente.';
  } else if (verification?.estado === 'RECHAZADA') {
    tone = 'error';
    icon = 'gpp_bad';
    title = 'Tu verificación no fue aprobada';
    text = verification.comentarioRevision
      ? `Motivo: ${verification.comentarioRevision}`
      : verification.motivos?.join(' ') || 'Puedes intentarlo de nuevo.';
    action = { label: 'Intentar de nuevo', icon: 'replay' };
  }

  return (
    <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${TONES[tone]}`}>
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[24px] mt-0.5">{icon}</span>
        <div>
          <strong className="block text-[14px]">{title}</strong>
          <span className="block text-[13px] opacity-90">{text}</span>
        </div>
      </div>
      {action && (
        <Link to={verificationPath(volver)} className="flex-shrink-0">
          <Button variant="fintech" size="sm" iconName={action.icon}>{action.label}</Button>
        </Link>
      )}
    </div>
  );
}
