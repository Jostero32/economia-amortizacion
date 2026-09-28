/**
 * Pruebas Unitarias - Datos de la cédula: MRZ (sin OCR), comparación de nombres y controles
 */
const { td1 } = require('../helpers/mrzFixtures');
const { mrzDate, parseTd1, datosFromFields, candidateLines, cleanNui } = require('../../src/services/identity/mrzService');
const { compareNames, nameTokens } = require('../../src/services/identity/nameMatch');
const { dataControls } = require('../../src/services/identity/dataChecks');
const { decide } = require('../../src/services/identity/decisionEngine');

const TODAY = '2026-09-28';

describe('Unitario: interpretación de la MRZ', () => {
  test('una MRZ TD1 válida se interpreta con todos sus datos', () => {
    const reading = parseTd1(td1());
    expect(reading).not.toBeNull();
    const datos = datosFromFields(reading.fields, reading.lines, new Date('2026-09-28T12:00:00'));
    expect(datos).toMatchObject({
      nui: '1712345600',
      numeroDocumento: '123456789',
      apellidos: 'PRUEBA DEMO',
      nombres: 'ANA MARIA',
      fechaNacimiento: '1990-05-15',
      fechaVencimiento: '2033-09-29',
      sexo: 'F',
      nacionalidad: 'ECU',
      donante: true,
    });
  });

  test('un dígito alterado invalida la lectura', () => {
    const lines = td1();
    lines[1] = `${lines[1].slice(0, 2)}9${lines[1].slice(3)}`; // cambia la fecha de nacimiento
    expect(parseTd1(lines)).toBeNull();
  });

  test('un NUI con el dígito verificador de la cédula incorrecto se rechaza', () => {
    expect(parseTd1(td1({ nui: '1712345601' }))).toBeNull();
  });

  test('las fechas AAMMDD toman el siglo correcto', () => {
    const today = new Date('2026-09-28T12:00:00');
    expect(mrzDate('020916', 'nacimiento', today)).toBe('2002-09-16');
    expect(mrzDate('931205', 'nacimiento', today)).toBe('1993-12-05');
    expect(mrzDate('310815', 'vencimiento', today)).toBe('2031-08-15');
    expect(mrzDate('12AB34', 'vencimiento', today)).toBeNull();
  });

  test('el NUI se limpia del relleno, venga como < o como espacios', () => {
    expect(cleanNui('<<<<<1712345600')).toBe('1712345600');
    expect(cleanNui('     1712345600')).toBe('1712345600');
  });

  test('las líneas leídas se ajustan a 30 caracteres', () => {
    expect(candidateLines('ruido\nI<ECU123\nABCDEFGHIJKLMNOPQRSTUVWXYZ12345678\nABCDEFGHIJKLMNOPQRSTUV')).toEqual([
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234',
      'ABCDEFGHIJKLMNOPQRSTUV<<<<<<<<',
    ]);
  });
});

describe('Unitario: comparación del nombre registrado con la MRZ', () => {
  const mrz = { apellidos: 'PRUEBA DEMO', nombres: 'ANA MARIA' };

  test('tildes, Ñ, mayúsculas y orden no importan', () => {
    expect(nameTokens('Ana María Núñez')).toEqual(['ANA', 'MARIA', 'NUNEZ']);
    expect(compareNames('Ana María Prueba Demo', mrz).coincide).toBe(true);
    expect(compareNames('prueba demo ana maría', mrz).coincide).toBe(true);
  });

  test('se puede omitir un segundo nombre o apellido', () => {
    expect(compareNames('Ana Prueba', mrz).coincide).toBe(true);
  });

  test('un nombre cortado por los 30 caracteres de la MRZ coincide', () => {
    expect(compareNames('Alejandra Prueba', { apellidos: 'PRUEBA', nombres: 'ALEJA' }).coincide).toBe(true);
  });

  test('tolera una letra mal leída por el OCR', () => {
    expect(compareNames('Ana Prueba', { apellidos: 'PRUEBA DEMO', nombres: 'ANN MARIA' }).coincide).toBe(true);
  });

  test('otra persona con los mismos apellidos no coincide', () => {
    const result = compareNames('Luis Alberto Prueba Demo', mrz);
    expect(result.coincide).toBe(false);
    expect(result.faltantes).toEqual(['LUIS', 'ALBERTO']);
  });

  test('con una sola palabra registrada, basta que esté en la cédula', () => {
    expect(compareNames('Ana', mrz).coincide).toBe(true); // registró solo un nombre y está en la cédula
    expect(compareNames('Pedro', mrz).coincide).toBe(false);
  });
});

describe('Unitario: controles de los datos de la cédula', () => {
  const datos = {
    nui: '1712345600',
    apellidos: 'PRUEBA DEMO',
    nombres: 'ANA MARIA',
    fechaNacimiento: '1990-05-15',
    fechaVencimiento: '2033-09-29',
  };
  const base = {
    tipoCedula: 'ELECTRONICA', datos, cedulaRegistrada: '1712345600', nombreRegistrado: 'Ana Prueba', cedulaEnOtraCuenta: false, today: TODAY,
  };
  const byCode = (controles) => Object.fromEntries(controles.map((c) => [c.codigo, c]));
  const faceOk = ['ROSTRO_CEDULA', 'ROSTRO_SELFIE', 'ROSTRO_COINCIDE'].map((codigo) => ({ codigo, ok: true, detalle: codigo, siFalla: 'REINTENTO' }));

  test('con todo coincidente, las reglas aprueban automáticamente', () => {
    const controles = [...faceOk, ...dataControls(base)];
    expect(controles.every((c) => c.ok)).toBe(true);
    expect(decide({ controles, intentos: 1, maxIntentos: 3 }).resultado).toBe('APROBADA');
  });

  test('sin cédula registrada, la leída se adoptará', () => {
    const c = byCode(dataControls({ ...base, cedulaRegistrada: null }));
    expect(c.NUI_COINCIDE.ok).toBe(true);
    expect(c.NUI_COINCIDE.detalle).toMatch(/Registraremos/);
  });

  test('una cédula distinta a la registrada pasa al asesor', () => {
    const controles = [...faceOk, ...dataControls({ ...base, cedulaRegistrada: '1712345618' })];
    const result = decide({ controles, intentos: 1, maxIntentos: 3 });
    expect(result.resultado).toBe('EN_REVISION');
    expect(result.motivos[0]).toMatch(/no coincide con el de tu cuenta/);
  });

  test('una cédula usada en otra cuenta pasa al asesor', () => {
    const controles = [...faceOk, ...dataControls({ ...base, cedulaEnOtraCuenta: true })];
    expect(decide({ controles, intentos: 1, maxIntentos: 3 }).motivos).toEqual(['Esta cédula ya está registrada en otra cuenta.']);
  });

  test('una cédula vencida se rechaza', () => {
    const controles = [...faceOk, ...dataControls({ ...base, datos: { ...datos, fechaVencimiento: '2026-01-31' } })];
    const result = decide({ controles, intentos: 1, maxIntentos: 3 });
    expect(result.resultado).toBe('RECHAZADA');
    expect(result.motivos[0]).toMatch(/venció el 31\/01\/2026/);
  });

  test('una persona menor de edad se rechaza', () => {
    const controles = [...faceOk, ...dataControls({ ...base, datos: { ...datos, fechaNacimiento: '2010-01-01' } })];
    expect(decide({ controles, intentos: 1, maxIntentos: 3 }).resultado).toBe('RECHAZADA');
  });

  test('la cédula del modelo anterior pasa al asesor', () => {
    const controles = [...faceOk, ...dataControls({ ...base, tipoCedula: 'ANTIGUA', datos: null })];
    const result = decide({ controles, intentos: 1, maxIntentos: 3 });
    expect(result.resultado).toBe('EN_REVISION');
    expect(result.motivos[0]).toMatch(/modelo anterior/);
  });
});
