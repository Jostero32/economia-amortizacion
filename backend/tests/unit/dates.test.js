/**
 * Pruebas Unitarias - Fecha actual en la zona horaria de Ecuador
 * Verifica que el "hoy" no se adelante al día siguiente cuando en UTC ya cambió la fecha.
 */

const { todayISO } = require('../../src/utils/dates');

describe('Fecha actual en Ecuador (America/Guayaquil, UTC-5)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('a las 20:30 en Ecuador sigue siendo el mismo día aunque en UTC ya sea el siguiente', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T01:30:00Z'));
    expect(todayISO()).toBe('2026-09-27');
  });

  test('a las 00:30 en Ecuador ya corresponde al nuevo día', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T05:30:00Z'));
    expect(todayISO()).toBe('2026-09-28');
  });

  test('devuelve el formato YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Aritmética de fechas de solo día', () => {
  const { addMonthsClamped, addDays, daysBetween, ageOn } = require('../../src/utils/dates');

  test('un pago el 31 de enero se mueve al último día de los meses más cortos', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonthsClamped('2026-01-31', 3)).toBe('2026-04-30');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29'); // año bisiesto
  });

  test('suma meses cruzando el cambio de año', () => {
    expect(addMonthsClamped('2026-11-15', 3)).toBe('2027-02-15');
  });

  test('suma días calendario y calcula la diferencia en días', () => {
    expect(addDays('2026-09-26', 360)).toBe('2027-09-21');
    expect(daysBetween('2026-09-26', '2027-09-21')).toBe(360);
  });

  test('calcula la edad en años cumplidos', () => {
    expect(ageOn('2008-09-28', '2026-09-27')).toBe(17);
    expect(ageOn('2008-09-27', '2026-09-27')).toBe(18);
  });

  test('rechaza fechas inexistentes', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow('Fecha inválida');
  });
});
