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
