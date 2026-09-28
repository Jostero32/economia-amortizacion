import React from 'react';
import Badge from '../Badge';
import { identityLabel } from './identityStatus';

/**
 * Estado de identidad del titular en las tablas del asesor.
 * @param {{estado: string|null, verificada: boolean}} props.identidad
 * @param {boolean} props.legacyValidated - Solicitud anterior con la biometría ya validada
 */
export default function IdentityBadge({ identidad, legacyValidated = false }) {
  if (!identidad?.estado && legacyValidated) {
    return <Badge variant="VALIDADO" size="sm" iconName="check_circle">Validada (flujo anterior)</Badge>;
  }
  const info = identityLabel(identidad);
  return <Badge variant={info.variant} size="sm" iconName={info.icon}>{info.label}</Badge>;
}
