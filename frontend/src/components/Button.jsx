import React from 'react';

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  loadingText = 'Calculando...',
  onClick,
  className = '',
  icon: Icon,
  iconName,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary: 'bg-primary hover:bg-primary-container text-white shadow-sm rounded-lg',
    fintech: 'bg-secondary hover:bg-secondary-container text-white shadow-sm rounded-lg',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-primary rounded-lg',
    outline: 'border border-gray-200 bg-transparent text-primary hover:bg-gray-50 rounded-lg',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm',
    destructive: 'border border-red-200 text-red-600 hover:bg-red-50 rounded-lg',
    danger: 'bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm',
    ghost: 'text-on-surface-variant hover:bg-gray-100 hover:text-on-surface rounded-lg',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-[13px]',
    md: 'px-4 py-2 text-[14px]',
    lg: 'px-5 py-2.5 text-[15px]',
    xl: 'px-6 py-3 text-[16px] font-semibold',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>{loadingText}</span>
        </span>
      ) : (
        <>
          {iconName && (
            <span className="material-symbols-outlined text-[18px] mr-1.5 -ml-0.5">
              {iconName}
            </span>
          )}
          {Icon && <Icon className="h-4 w-4 mr-1.5 -ml-0.5" />}
          {children}
        </>
      )}
    </button>
  );
}
