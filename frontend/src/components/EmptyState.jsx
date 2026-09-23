import React from 'react';

export default function EmptyState({
  iconName = 'folder_open',
  title = 'No hay datos disponibles',
  description = 'No se encontraron registros en este momento.',
  action,
  className = '',
}) {
  return (
    <div
      className={`p-space-xl flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-surface-container-highest bg-surface-container-low/40 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant mb-space-sm">
        <span className="material-symbols-outlined text-[28px]">{iconName}</span>
      </div>
      <h3 className="font-title-md text-[16px] text-primary">{title}</h3>
      <p className="font-body-sm text-[13px] text-on-surface-variant max-w-sm mt-1 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-space-md">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Ocurrió un error al cargar los datos',
  message = 'No se pudo completar la solicitud. Por favor intente nuevamente.',
  onRetry,
  className = '',
}) {
  return (
    <div
      className={`p-space-xl flex flex-col items-center justify-center text-center rounded-xl border border-error/20 bg-error-container/10 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-error-container flex items-center justify-center text-error mb-space-sm">
        <span className="material-symbols-outlined text-[28px]">error</span>
      </div>
      <h3 className="font-title-md text-[16px] text-primary">{title}</h3>
      <p className="font-body-sm text-[13px] text-on-surface-variant max-w-sm mt-1 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-space-md px-4 py-2 bg-primary-container text-on-primary rounded-lg font-title-md text-[13px] hover:bg-primary transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Reintentar
        </button>
      )}
    </div>
  );
}
