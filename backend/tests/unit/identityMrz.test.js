/**
 * Pruebas Unitarias - Lectura real de la MRZ (Tesseract.js con el modelo `mrz` de assets/ocr)
 * La imagen es una cédula sintética (tests/fixtures/mrz-sintetica.jpg), sin datos de personas reales;
 * sus líneas son las de tests/helpers/mrzFixtures.js con los valores por defecto.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { readMrz } = require('../../src/services/identity/mrzService');

jest.setTimeout(60000);

describe('Unitario: lectura real de la MRZ', () => {
  const card = fs.readFileSync(path.join(__dirname, '../fixtures/mrz-sintetica.jpg'));

  test('lee la MRZ con consenso y devuelve los datos protegidos por los dígitos de control', async () => {
    const result = await readMrz(card);
    expect(result).toMatchObject({ leida: true, consenso: true });
    expect(result.datos).toMatchObject({
      nui: '1712345600',
      numeroDocumento: '123456789',
      fechaNacimiento: '1990-05-15',
      fechaVencimiento: '2033-09-29',
      sexo: 'F',
      apellidos: 'PRUEBA DEMO',
      nombres: 'ANA MARIA',
    });
  });

  test('una tarjeta sin MRZ (cédula antigua) se descarta sin agotar todos los intentos', async () => {
    const withoutMrz = await sharp({ create: { width: 1000, height: 630, channels: 3, background: '#e4edf2' } }).jpeg().toBuffer();
    const result = await readMrz(withoutMrz);
    expect(result.leida).toBe(false);
    expect(result.intentos).toBeLessThanOrEqual(7);
  });
});
