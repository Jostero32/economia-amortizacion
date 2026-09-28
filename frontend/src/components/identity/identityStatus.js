import { useCallback, useEffect, useState } from 'react';
import { identityService } from '../../services/api';

// Estados de la verificación de identidad
export const IDENTITY_STATES = {
  EN_CURSO: { label: 'En curso', variant: 'PENDIENTE', icon: 'pending' },
  EN_REVISION: { label: 'En revisión', variant: 'EN_REVISION', icon: 'hourglass_top' },
  APROBADA: { label: 'Verificada', variant: 'APROBADA', icon: 'verified_user' },
  RECHAZADA: { label: 'No aprobada', variant: 'RECHAZADA', icon: 'gpp_bad' },
};

const NOT_STARTED = { label: 'Sin verificar', variant: 'warning', icon: 'shield' };
const EXPIRED = { label: 'Cédula vencida', variant: 'warning', icon: 'event_busy' };

/** Etiqueta del estado de identidad de un cliente ({ estado, verificada }). */
export function identityLabel(identidad) {
  if (!identidad?.estado) return NOT_STARTED;
  if (identidad.estado === 'APROBADA' && identidad.verificada === false) return EXPIRED;
  return IDENTITY_STATES[identidad.estado] || NOT_STARTED;
}

/** Ruta interna a la que volver tras verificarse (solo dentro del portal del cliente). */
export function safeReturnPath(value) {
  return typeof value === 'string' && value.startsWith('/cliente') && !value.startsWith('//') ? value : null;
}

export const verificationPath = (volver) => (volver ? `/cliente/verificacion?volver=${encodeURIComponent(volver)}` : '/cliente/verificacion');

/** Estado de identidad del cliente autenticado: { verification, verificada, puedeSolicitar, consentimientoVersion }. */
export function useIdentityStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const response = await identityService.getMine();
      setStatus(response.data);
      setError(null);
    } catch (err) {
      setError(err.message || 'No pudimos consultar tu verificación de identidad.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { status, loading, error, reload };
}
