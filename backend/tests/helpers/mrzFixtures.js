/**
 * MRZ sintéticas (formato TD1 de la cédula ecuatoriana) con dígitos de control correctos.
 * Sin datos de personas reales: sirven para probar la lectura y las reglas.
 */
const charValue = (c) => {
  if (c === '<') return 0;
  if (/\d/.test(c)) return Number(c);
  return c.charCodeAt(0) - 55; // A = 10 … Z = 35
};

/** Dígito de control OACI: pesos 7-3-1, módulo 10. */
const checkDigit = (text) => String([...text].reduce((sum, c, i) => sum + charValue(c) * [7, 3, 1][i % 3], 0) % 10);

/**
 * Tres líneas TD1: documento, NUI (dato opcional 1), nacimiento, sexo, vencimiento, donante y nombres.
 */
function td1({
  documento = '123456789',
  nui = '1712345600',
  nacimiento = '900515',
  sexo = 'F',
  vencimiento = '330929',
  donante = '<SI<<<<<<<<',
  nombres = 'PRUEBA<DEMO<<ANA<MARIA',
} = {}) {
  const docPart = `${documento}${checkDigit(documento)}<<<<<${nui}`;
  const birthPart = `${nacimiento}${checkDigit(nacimiento)}`;
  const expiryPart = `${vencimiento}${checkDigit(vencimiento)}`;
  const composite = checkDigit(`${docPart}${birthPart}${expiryPart}${donante}`);
  return [
    `I<ECU${docPart}`,
    `${birthPart}${sexo}${expiryPart}ECU${donante}${composite}`,
    nombres.padEnd(30, '<').slice(0, 30),
  ];
}

module.exports = { checkDigit, td1 };
