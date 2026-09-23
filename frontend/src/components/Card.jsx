import React from 'react';

export default function Card({
  children,
  title,
  subtitle,
  iconName,
  badge,
  action,
  className = '',
  headerClassName = '',
  bodyClassName = 'p-6',
  hover = false,
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] ${
        hover ? 'hover:border-gray-200 hover:shadow-sm transition-all' : ''
      } ${className}`}
    >
      {(title || subtitle || action || iconName || badge) && (
        <div
          className={`px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 ${headerClassName}`}
        >
          <div className="flex items-center gap-3">
            {iconName && (
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[18px]">{iconName}</span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                {title && <h3 className="font-semibold text-[16px] text-primary">{title}</h3>}
                {badge && <div>{badge}</div>}
              </div>
              {subtitle && <p className="text-[13px] text-on-surface-variant mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
