/**
 * Comparación del nombre registrado con el de la MRZ. La MRZ quita tildes, cambia Ñ por N, va en
 * mayúsculas y se corta a 30 caracteres; además la línea de nombres no tiene dígito de control, así
 * que el OCR puede equivocar alguna letra. Se compara por palabras, sin importar el orden.
 */

// Partículas de apellidos compuestos: no cuentan como palabras que coinciden
const PARTICLES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'DA', 'DOS', 'SAN']);

/** Palabras en formato MRZ: sin tildes, Ñ→N, mayúsculas y sin partículas. */
function nameTokens(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token && !PARTICLES.has(token));
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = temp;
    }
  }
  return previous[b.length];
}

/** Una palabra registrada coincide con una de la MRZ: igual, cortada al final o con 1–2 letras de OCR. */
function tokenMatches(registered, mrz) {
  if (registered === mrz) return true;
  // La MRZ se corta a 30 caracteres: la última palabra puede ser solo el inicio (CAROLINA → CAROL)
  if (mrz.length >= 3 && registered.startsWith(mrz)) return true;
  return levenshtein(registered, mrz) <= (registered.length >= 7 ? 2 : 1);
}

/**
 * @param {string} registeredName - Nombre de la cuenta (en cualquier orden)
 * @param {{apellidos: string, nombres: string}} mrz
 * @returns {{coincide: boolean, coincidentes: number, faltantes: string[]}}
 *   Coincide si todas las palabras registradas están en la cédula (al menos 2): puede omitir un
 *   segundo nombre o apellido, pero no tener palabras que la cédula no tiene.
 */
function compareNames(registeredName, mrz) {
  const registered = nameTokens(registeredName);
  const available = nameTokens(`${mrz?.apellidos || ''} ${mrz?.nombres || ''}`);
  const faltantes = [];
  let coincidentes = 0;
  for (const token of registered) {
    const index = available.findIndex((candidate) => tokenMatches(token, candidate));
    if (index === -1) {
      faltantes.push(token);
    } else {
      coincidentes += 1;
      available.splice(index, 1); // cada palabra de la cédula se usa una sola vez
    }
  }
  return {
    coincide: faltantes.length === 0 && coincidentes >= Math.min(2, registered.length) && coincidentes > 0,
    coincidentes,
    faltantes,
  };
}

module.exports = {
  nameTokens,
  tokenMatches,
  compareNames,
};
