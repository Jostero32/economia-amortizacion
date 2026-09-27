// Validaciones de datos personales (mismas reglas que el backend)

// Letras (incluye tildes y ñ), espacios, apóstrofo y guion
export const PERSON_NAME_PATTERN = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/;
const PHONE_PATTERN = /^(09\d{8}|0[2-7]\d{7})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Cédula ecuatoriana: provincia 01-24 o 30, tercer dígito < 6 y dígito verificador módulo 10
 */
export function isValidCedula(value) {
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
  return (10 - (sum % 10)) % 10 === Number(cedula[9]);
}

export function isValidPhone(value) {
  return PHONE_PATTERN.test(String(value || '').replace(/[\s-]/g, ''));
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || '').trim());
}

export function isValidMoney(value) {
  return MONEY_PATTERN.test(String(value ?? '').trim());
}

/**
 * Edad en años cumplidos a partir de una fecha YYYY-MM-DD
 */
export function ageFrom(birthDate, today) {
  const [by, bm, bd] = String(birthDate).split('-').map(Number);
  const [ty, tm, td] = String(today).split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

// Reglas reutilizables: devuelven el mensaje de error o undefined
export const rules = {
  name: (value, label) => {
    const text = String(value || '').trim();
    if (!text) return `Ingresa tus ${label}.`;
    if (text.length < 2) return `Tus ${label} deben tener al menos 2 caracteres.`;
    if (!PERSON_NAME_PATTERN.test(text)) return `Tus ${label} solo pueden contener letras y espacios.`;
    return undefined;
  },
  cedula: (value) => {
    if (!String(value || '').trim()) return 'Ingresa tu número de cédula.';
    if (!isValidCedula(value)) return 'La cédula no es válida. Revisa los 10 dígitos.';
    return undefined;
  },
  phone: (value) => {
    if (!String(value || '').trim()) return 'Ingresa tu número de teléfono.';
    if (!isValidPhone(value)) return 'Ingresa un celular de 10 dígitos (09...) o un teléfono fijo con código de provincia.';
    return undefined;
  },
  email: (value) => {
    if (!String(value || '').trim()) return 'Ingresa tu correo electrónico.';
    if (!isValidEmail(value)) return 'El correo electrónico no es válido.';
    return undefined;
  },
  required: (value, message) => (String(value ?? '').trim() ? undefined : message),
  money: (value, { emptyMessage, allowZero = false }) => {
    if (String(value ?? '').trim() === '') return emptyMessage;
    if (!isValidMoney(value)) return 'Ingresa un valor válido, sin letras y con máximo 2 decimales.';
    if (!allowZero && Number(value) <= 0) return 'El valor debe ser mayor a $0.';
    return undefined;
  },
};
