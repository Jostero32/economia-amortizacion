import React from 'react';
import Badge from '../Badge';
import { STATUS_LABELS, STATUS_DESCRIPTIONS } from './applicationStatus';

/**
 * Estado de la solicitud explicado al cliente, con la observación del asesor si existe
 */
export default function ApplicationStatusBanner({ application }) {
  const { estado, observacionAsesor } = application;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={estado} size="lg">{STATUS_LABELS[estado] || estado}</Badge>
        <p className="text-[14px] text-gray-700">{STATUS_DESCRIPTIONS[estado]}</p>
      </div>
      {observacionAsesor && (
        <div className="rounded-lg bg-surface-container-low border border-surface-container-high p-3 text-[13px]">
          <span className="block text-[11px] uppercase tracking-wide text-on-surface-variant font-semibold mb-0.5">
            Observación del asesor
          </span>
          <p className="text-primary">{observacionAsesor}</p>
        </div>
      )}
    </div>
  );
}
