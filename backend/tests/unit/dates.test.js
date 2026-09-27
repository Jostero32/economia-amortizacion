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
