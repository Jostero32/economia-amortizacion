import React from 'react';

export default function FormInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  hint,
  required = false,
  disabled = false,
  options = [],
  rows = 3,
  prefix,
  suffix,
  iconName,
  className = '',
  inputClassName = '',
  ...props
}) {
  const isNumeric = type === 'number' || prefix === '$' || suffix === '%' || prefix === '%';

  const baseInputStyles = `block w-full h-11 rounded-lg border text-body-md transition-colors focus:outline-none disabled:bg-surface-container-low disabled:cursor-not-allowed ${
    isNumeric ? 'font-numeric-data' : 'font-body-md'
  }`;

  const stateStyles = error
    ? 'border-error bg-error-container/20 text-on-surface focus:border-error focus:ring-2 focus:ring-error/20'
    : 'border-outline-variant/60 bg-surface-container-low/50 text-on-surface hover:border-outline-variant focus:border-secondary focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/15';

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={name} className="block font-title-md text-[13px] text-primary">
          {label} {required && <span className="text-error font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {iconName && !prefix && (
          <span className="absolute left-3.5 material-symbols-outlined text-on-surface-variant text-[18px] pointer-events-none">
            {iconName}
          </span>
        )}

        {prefix && (
          <span className="absolute left-3.5 font-numeric-data font-bold text-primary text-[15px] pointer-events-none select-none">
            {prefix}
          </span>
        )}

        {type === 'select' ? (
          <div className="w-full relative">
            <select
              id={name}
              name={name}
              value={value}
              onChange={onChange}
              disabled={disabled}
              className={`${baseInputStyles} ${stateStyles} px-3.5 pr-10 appearance-none cursor-pointer ${inputClassName}`}
              {...props}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">
              expand_more
            </span>
          </div>
        ) : type === 'textarea' ? (
          <textarea
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            className={`block w-full rounded-lg border text-body-md transition-colors p-3 focus:outline-none ${stateStyles} ${inputClassName}`}
            {...props}
          />
        ) : (
          <input
            id={name}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            className={`${baseInputStyles} ${stateStyles} ${
              prefix ? 'pl-8' : iconName ? 'pl-10' : 'px-3.5'
            } ${suffix ? 'pr-12' : 'pr-3.5'} ${inputClassName}`}
            {...props}
          />
        )}

        {suffix && (
          <span className="absolute right-3.5 font-body-sm font-semibold text-on-surface-variant pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>

      {hint && !error && <p className="font-body-sm text-[11px] text-on-surface-variant">{hint}</p>}
      {error && <p className="font-body-sm text-[11px] font-medium text-error">{error}</p>}
    </div>
  );
}
