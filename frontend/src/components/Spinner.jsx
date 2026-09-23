import React from 'react';

export default function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div
      className={`inline-block animate-spin rounded-full border-solid border-secondary border-t-transparent ${
        sizes[size] || sizes.md
      } ${className}`}
      role="status"
    >
      <span className="sr-only">Cargando...</span>
    </div>
  );
}

export function LoadingState({ message = 'Cargando información...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center p-space-xl text-center ${className}`}>
      <Spinner size="lg" />
      <p className="mt-space-md font-title-md text-[14px] text-primary">{message}</p>
      <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">
        Conectando con el servidor financiero...
      </p>
    </div>
  );
}
