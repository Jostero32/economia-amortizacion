// Zona horaria de referencia: la misma que usa el backend para validar fechas
const TIME_ZONE = 'America/Guayaquil';

/**
 * Fecha actual en Ecuador con formato YYYY-MM-DD.
 * No usar toISOString(): devuelve la fecha UTC, que desde las 19:00 ya es el día siguiente.
 */
export function todayISO() {
  // La configuración regional en-CA formatea las fechas como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Suma días calendario a una fecha YYYY-MM-DD
 */
export function addDaysISO(isoDate, days) {
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

/**
 * Suma meses conservando el día; si el mes destino es más corto usa su último día
 */
export function addMonthsISO(isoDate, months) {
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
  return date.toISOString().slice(0, 10);
}
