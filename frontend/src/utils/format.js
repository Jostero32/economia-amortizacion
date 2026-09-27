// Formatos de presentación compartidos (convención es-EC: $1.234,56 y dd/mm/aaaa)

const moneyFormatter = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeMoneyFormatter = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Monto en dólares con 2 decimales. Valores vacíos o inválidos se muestran como $0,00.
 */
export function formatMoney(value) {
  const number = Number(value);
  return moneyFormatter.format(Number.isFinite(number) ? number : 0);
}

/**
 * Monto en dólares sin decimales (para límites y catálogos)
 */
export function formatMoneyWhole(value) {
  const number = Number(value);
  return wholeMoneyFormatter.format(Number.isFinite(number) ? number : 0);
}

/**
 * Porcentaje con hasta `maxDecimals` decimales (0,065 % no debe mostrarse como 0,07 %)
 */
export function formatPercent(value, maxDecimals = 2, minDecimals = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toLocaleString('es-EC', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  })}%`;
}

/**
 * Fecha YYYY-MM-DD como dd/mm/aaaa, sin conversión de zona horaria
 */
export function formatDate(value) {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return String(value);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Fecha y hora local (para registros como createdAt)
 */
export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
}
