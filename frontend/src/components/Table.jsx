import React from 'react';

export default function Table({
  headers = [],
  children,
  footer,
  className = '',
  zebra = false,
}) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-surface-container-high bg-surface shadow-xs ${className}`}>
      <table className="w-full text-left font-body-sm text-[13px]">
        {headers.length > 0 && (
          <thead className="bg-surface-container-low text-on-surface-variant font-badge-label text-[11px] uppercase tracking-wider border-b-2 border-surface-container-high">
            <tr>
              {headers.map((h, idx) => {
                const isObject = typeof h === 'object';
                const label = isObject ? h.label : h;
                const align = isObject && h.align ? h.align : 'text-left';
                return (
                  <th key={idx} scope="col" className={`py-3 px-4 ${align} font-bold select-none`}>
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}
        <tbody
          className={`divide-y divide-surface-container-high/60 bg-surface-container-lowest font-numeric-data text-on-surface ${
            zebra ? '[&>tr:nth-child(even)]:bg-surface-container-low/30' : ''
          }`}
        >
          {children}
        </tbody>
        {footer && (
          <tfoot className="bg-surface-container-high font-numeric-data text-primary font-bold border-t-2 border-surface-container-highest">
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );
}
