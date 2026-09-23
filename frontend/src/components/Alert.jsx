import React from 'react';

export default function Alert({
  children,
  title,
  type = 'info',
  iconName,
  className = '',
  action,
}) {
  const styles = {
    info: {
      bg: 'bg-surface-container-low border-surface-container-high text-primary',
      icon: 'info',
      iconColor: 'text-secondary',
    },
    success: {
      bg: 'bg-emerald-50/80 border-emerald-200 text-emerald-950',
      icon: 'check_circle',
      iconColor: 'text-emerald-600',
    },
    warning: {
      bg: 'bg-amber-50/80 border-amber-200 text-amber-950',
      icon: 'warning',
      iconColor: 'text-amber-600',
    },
    error: {
      bg: 'bg-rose-50/80 border-rose-200 text-rose-950',
      icon: 'error',
      iconColor: 'text-rose-600',
    },
    ceiling: {
      bg: 'bg-red-50 border-red-200 text-red-950',
      icon: 'gavel',
      iconColor: 'text-red-600',
    },
  };

  const current = styles[type] || styles.info;
  const displayIcon = iconName || current.icon;

  return (
    <div
      className={`p-space-md rounded-lg border flex items-start gap-space-sm font-body-sm text-[13px] ${current.bg} ${className}`}
    >
      <span className={`material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5 ${current.iconColor}`}>
        {displayIcon}
      </span>
      <div className="flex-1">
        {title && <h4 className="font-title-md text-[14px] font-bold mb-0.5">{title}</h4>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
