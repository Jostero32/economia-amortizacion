/**
 * Utilidades para fechas de solo día (YYYY-MM-DD).
 *
 * El "hoy" se determina en la zona horaria de Ecuador y no en UTC:
 * desde las 19:00 (UTC-5) la fecha UTC ya corresponde al día siguiente.
 */

const TIME_ZONE = 'America/Guayaquil';

/**
 * Fecha actual en Ecuador con formato YYYY-MM-DD
 * @returns {string}
 */
function todayISO() {
  // La configuración regional en-CA formatea las fechas como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

module.exports = {
  TIME_ZONE,
  todayISO,
};
