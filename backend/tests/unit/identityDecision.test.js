/**
 * Pruebas Unitarias - Reglas de decisión de la verificación de identidad
 */
const {
  AUTO_APPROVAL_CONTROLS,
  PENDING_DATA_MOTIVE,
  decide,
  storedState,
} = require('../../src/services/identity/decisionEngine');

const control = (codigo, ok, siFalla = 'REVISION') => ({ codigo, ok, detalle: `detalle ${codigo}`, siFalla });
const allOk = () => AUTO_APPROVAL_CONTROLS.map((codigo) => control(codigo, true));

describe('Unitario: decisión de la verificación de identidad', () => {
  test('aprueba automáticamente cuando todos los controles requeridos se cumplen', () => {
    const result = decide({ controles: allOk(), intentos: 1, maxIntentos: 3 });
    expect(result).toEqual({ resultado: 'APROBADA', aprobacionAutomatica: true, motivos: [] });
  });

  test('sin los controles de la cédula (fase 1) la decisión es del asesor', () => {
    const controles = [control('ROSTRO_CEDULA', true), control('ROSTRO_SELFIE', true), control('ROSTRO_COINCIDE', true)];
    const result = decide({ controles, intentos: 1, maxIntentos: 3 });
    expect(result.resultado).toBe('EN_REVISION');
    expect(result.aprobacionAutomatica).toBe(false);
    expect(result.motivos).toEqual([PENDING_DATA_MOTIVE]);
  });

  test('un control de rechazo que falla rechaza aunque otros pidan reintento', () => {
    const controles = [
      ...allOk().filter((c) => c.codigo !== 'CEDULA_VIGENTE' && c.codigo !== 'ROSTRO_COINCIDE'),
      control('CEDULA_VIGENTE', false, 'RECHAZO'),
      control('ROSTRO_COINCIDE', false, 'REINTENTO'),
    ];
    const result = decide({ controles, intentos: 1, maxIntentos: 3 });
    expect(result.resultado).toBe('RECHAZADA');
    expect(result.motivos).toEqual(['detalle CEDULA_VIGENTE']);
  });

  test('un control de reintento que falla pide reintentar mientras queden intentos', () => {
    const controles = [control('ROSTRO_CEDULA', true), control('ROSTRO_SELFIE', false, 'REINTENTO')];
    expect(decide({ controles, intentos: 2, maxIntentos: 3 }).resultado).toBe('REINTENTAR');
  });

  test('al agotar los intentos el caso pasa al asesor con el motivo', () => {
    const controles = [control('ROSTRO_COINCIDE', false, 'REINTENTO')];
    const result = decide({ controles, intentos: 3, maxIntentos: 3 });
    expect(result.resultado).toBe('EN_REVISION');
    expect(result.motivos).toEqual(['detalle ROSTRO_COINCIDE', 'Se agotaron los 3 intentos: un asesor revisará tu verificación.']);
  });

  test('un control de revisión que falla envía al asesor con su motivo', () => {
    const controles = allOk().map((c) => (c.codigo === 'NOMBRE_COINCIDE' ? control('NOMBRE_COINCIDE', false) : c));
    const result = decide({ controles, intentos: 1, maxIntentos: 3 });
    expect(result).toEqual({ resultado: 'EN_REVISION', aprobacionAutomatica: false, motivos: ['detalle NOMBRE_COINCIDE'] });
  });

  test('un control que no se pudo evaluar impide la aprobación automática', () => {
    const controles = allOk().map((c) => (c.codigo === 'MRZ_LEGIBLE' ? control('MRZ_LEGIBLE', null) : c));
    expect(decide({ controles, intentos: 1, maxIntentos: 3 }).resultado).toBe('EN_REVISION');
  });

  test('reintentar deja la verificación en curso; el resto se guarda tal cual', () => {
    expect(storedState('REINTENTAR')).toBe('EN_CURSO');
    expect(storedState('EN_REVISION')).toBe('EN_REVISION');
    expect(storedState('APROBADA')).toBe('APROBADA');
    expect(storedState('RECHAZADA')).toBe('RECHAZADA');
  });
});
