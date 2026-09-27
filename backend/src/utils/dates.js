/**
 * Utilidades para fechas de solo día (YYYY-MM-DD).
 *
 * El "hoy" se determina en la zona horaria de Ecuador y no en UTC:
 * desde las 19:00 (UTC-5) la fecha UTC ya corresponde al día siguiente.
 *
 * La aritmética de fechas se hace sobre componentes año/mes/día en UTC para que
 * el resultado no dependa de la zona horaria del servidor.
 */

const TIME_ZONE = 'America/Guayaquil';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

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

function daysInMonth(year, month) {
  // El día 0 del mes siguiente es el último día del mes indicado (month en base 1)
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatISODate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Normaliza una fecha (YYYY-MM-DD, fecha-hora ISO o Date) a sus componentes.
 * @returns {{ year: number, month: number, day: number }}
 */
function parseISODate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('Fecha inválida.');
    return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
  }

  const match = ISO_DATE_PATTERN.exec(String(value || ''));
  if (!match) throw new Error(`Fecha inválida: '${value}'. Use el formato YYYY-MM-DD.`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Fecha inválida: '${value}'.`);
  }
  return { year, month, day };
}

function toISODate(value) {
  const { year, month, day } = parseISODate(value);
  return formatISODate(year, month, day);
}

/**
 * Suma meses conservando el día de pago; si el mes destino es más corto se usa su
 * último día (31-ene + 1 mes = 28-feb; 31-ene + 2 meses = 31-mar).
 */
function addMonthsClamped(value, months) {
  const { year, month, day } = parseISODate(value);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12 + 1;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return formatISODate(targetYear, targetMonth, targetDay);
}

/**
 * Suma días calendario
 */
function addDays(value, days) {
  const { year, month, day } = parseISODate(value);
  const date = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY);
  return formatISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Días calendario entre dos fechas (to - from)
 */
function daysBetween(from, to) {
  const a = parseISODate(from);
  const b = parseISODate(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / MS_PER_DAY
  );
}

/**
 * Edad en años cumplidos a una fecha de referencia
 */
function ageOn(birthDate, onDate = todayISO()) {
  const birth = parseISODate(birthDate);
  const ref = parseISODate(onDate);
  let age = ref.year - birth.year;
  if (ref.month < birth.month || (ref.month === birth.month && ref.day < birth.day)) {
    age -= 1;
  }
  return age;
}

module.exports = {
  TIME_ZONE,
  todayISO,
  parseISODate,
  toISODate,
  addMonthsClamped,
  addDays,
  daysBetween,
  ageOn,
};
