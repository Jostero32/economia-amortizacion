/**
 * Pruebas Unitarias - Validación de cédula ecuatoriana y teléfono
 */

const { isValidCedula, isValidPhone } = require('../../src/utils/identity');

describe('Cédula de identidad ecuatoriana', () => {
  test('acepta cédulas con dígito verificador correcto', () => {
    ['1710000009', '1720000007', '0926687856', '3050000003'].forEach((cedula) => {
      expect(isValidCedula(cedula)).toBe(true);
    });
  });

  test('rechaza un dígito verificador incorrecto', () => {
    expect(isValidCedula('1710000001')).toBe(false);
  });

  test('rechaza longitud, caracteres, provincia o tercer dígito inválidos', () => {
    expect(isValidCedula('171000000')).toBe(false); // 9 dígitos
    expect(isValidCedula('17100000A9')).toBe(false); // letras
    expect(isValidCedula('2510000009')).toBe(false); // provincia 25 no existe
    expect(isValidCedula('1760000009')).toBe(false); // tercer dígito >= 6 (no es persona natural)
    expect(isValidCedula('')).toBe(false);
  });
});

describe('Teléfono ecuatoriano', () => {
  test('acepta celulares de 10 dígitos y fijos con código de provincia', () => {
    expect(isValidPhone('0991234567')).toBe(true);
    expect(isValidPhone('022999999')).toBe(true);
    expect(isValidPhone('099 123 4567')).toBe(true);
  });

  test('rechaza números incompletos o sin prefijo válido', () => {
    expect(isValidPhone('099123')).toBe(false);
    expect(isValidPhone('1991234567')).toBe(false);
    expect(isValidPhone('0891234567')).toBe(false);
  });
});
