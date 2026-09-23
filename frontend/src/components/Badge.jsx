import React from 'react';

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  iconName,
  className = '',
}) {
  const variants = {
    default: 'bg-gray-100 text-gray-700 border border-gray-200/80',
    primary: 'bg-blue-50 text-blue-700 border border-blue-100',
    fintech: 'bg-secondary text-white font-medium',
    bce: 'bg-blue-50 text-blue-700 border border-blue-200/60',
    seps: 'bg-emerald-50 text-emerald-800 border border-emerald-200/60',
    demo: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    alert: 'bg-rose-50 text-rose-800 border border-rose-200/80',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    danger: 'bg-red-50 text-red-800 border border-red-200/80',
    outline: 'border border-gray-200 text-gray-600',
    // Estados de solicitud
    APROBADA: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
    RECHAZADA: 'bg-red-50 border border-red-200 text-red-800',
    PENDIENTE: 'bg-amber-50 border border-amber-200 text-amber-800',
    EN_REVISION: 'bg-blue-50 border border-blue-200 text-blue-800',
    PENDIENTE_DOCUMENTOS: 'bg-orange-50 border border-orange-200 text-orange-800',
    VALIDADO: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 rounded',
    md: 'text-[12px] px-2.5 py-0.5 rounded-md',
    lg: 'text-[13px] px-3 py-1 rounded-md',
  };

  const currentVariant = variants[variant] || variants.default;

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium select-none ${currentVariant} ${sizes[size]} ${className}`}
    >
      {iconName && <span className="material-symbols-outlined text-[13px]">{iconName}</span>}
      {children}
    </span>
  );
}
