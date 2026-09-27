/**
 * Validaciones de datos de identificación usados en Ecuador.
 */

// Letras (incluye tildes y ñ), espacios, apóstrofo y guion: "María José", "D'Alessio"
const PERSON_NAME_PATTERN = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/;

// Celular 09XXXXXXXX (10 dígitos) o fijo con código de provincia 0[2-7]XXXXXXX (9 dígitos)
const PHONE_PATTERN = /^(09\d{8}|0[2-7]\d{7})$/;

/**
 * Cédula de identidad ecuatoriana (persona natural):
 * - 10 dígitos; los dos primeros son la provincia (01 a 24, o 30 para ecuatorianos en el exterior)
 * - el tercer dígito es menor a 6
 * - el décimo dígito es el verificador (módulo 10 con coeficientes 2,1,2,1,2,1,2,1,2)
 */
function isValidCedula(value) {
  const cedula = String(value || '').trim();
  if (!/^\d{10}$/.test(cedula)) return false;

  const province = Number(cedula.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  if (Number(cedula[2]) >= 6) return false;

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const sum = coefficients.reduce((total, coefficient, index) => {
    const product = Number(cedula[index]) * coefficient;
    return total + (product > 9 ? product - 9 : product);
  }, 0);

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(cedula[9]);
}

function isValidPhone(value) {
  return PHONE_PATTERN.test(String(value || '').replace(/[\s-]/g, ''));
}

module.exports = {
  PERSON_NAME_PATTERN,
  PHONE_PATTERN,
  isValidCedula,
  isValidPhone,
};
