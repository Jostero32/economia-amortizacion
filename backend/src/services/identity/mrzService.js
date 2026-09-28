const path = require('path');
const sharp = require('sharp');
const { parse } = require('mrz');
const { isValidCedula } = require('../../utils/identity');

/**
 * Lectura de la MRZ (3 líneas × 30 caracteres, formato TD1 de la OACI) del reverso de la cédula
 * electrónica, con Tesseract.js y el modelo `mrz` (assets/ocr). Calibración en
 * docs/verificacion-identidad.md.
 */
const OCR_DIR = path.join(__dirname, '../../../assets/ocr');
const WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
// Zona MRZ (fracción del alto de la tarjeta: inicio, alto), con variantes por inclinación
const ZONES = [[0.62, 0.35], [0.58, 0.4], [0.66, 0.31]];
const SCALES = [1600, 1200, 2000];
const MODES = ['plain', 'norm'];
// Campos cubiertos por dígitos de control en TD1 (el compuesto salta sexo y nacionalidad; los
// nombres de la línea 3 no tienen control y se comparan con tolerancia)
const PROTECTED_FIELDS = ['documentNumber', 'optional1', 'birthDate', 'expirationDate', 'optional2'];

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      // eslint-disable-next-line global-require
      const { createWorker } = require('tesseract.js');
      const worker = await createWorker('mrz', 1, {
        langPath: OCR_DIR,
        gzip: false,
        cacheMethod: 'none',
        logger: () => {},
        errorHandler: () => {},
      });
      await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: WHITELIST });
      return worker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

// El NUI va en el dato opcional 1; la librería devuelve el relleno como '<' o como espacios
const cleanNui = (value) => String(value || '').replace(/[<\s]/g, '');

/** AAMMDD → AAAA-MM-DD. El nacimiento nunca es futuro; el vencimiento siempre es de este siglo. */
function mrzDate(value, kind, today = new Date()) {
  if (!/^\d{6}$/.test(String(value || ''))) return null;
  const yy = Number(value.slice(0, 2));
  const currentYY = today.getFullYear() % 100;
  const century = kind === 'nacimiento' && yy > currentYY ? 1900 : 2000;
  return `${century + yy}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
}

/** Datos de la cédula a partir de los campos que interpreta `mrz`. */
function datosFromFields(fields, lines, today = new Date()) {
  const optional2 = String(fields.optional2 || '').replace(/</g, ' ').trim();
  return {
    nui: cleanNui(fields.optional1),
    numeroDocumento: fields.documentNumber,
    apellidos: String(fields.lastName || '').trim(),
    nombres: String(fields.firstName || '').trim(),
    fechaNacimiento: mrzDate(fields.birthDate, 'nacimiento', today),
    fechaVencimiento: mrzDate(fields.expirationDate, 'vencimiento', today),
    sexo: { male: 'M', female: 'F' }[fields.sex] || null,
    nacionalidad: fields.nationality || null,
    donante: /^SI\b/.test(optional2) ? true : /^NO\b/.test(optional2) ? false : null,
    lineaNombres: lines[2],
  };
}

/** Líneas candidatas del texto reconocido, ajustadas a 30 caracteres. */
function candidateLines(text) {
  return text.split('\n')
    .map((t) => t.replace(/\s/g, ''))
    .filter((t) => t.length >= 20)
    .slice(-3)
    .map((l) => (l.length >= 30 ? l.slice(0, 30) : l.padEnd(30, '<')));
}

/**
 * Interpreta 3 líneas TD1 y exige todos los dígitos de control y el verificador de la cédula.
 * @returns {{fields: object, lines: string[]} | null}
 */
function parseTd1(lines) {
  if (lines.length !== 3) return null;
  try {
    const result = parse(lines, { autocorrect: true });
    if (!result.valid || !isValidCedula(cleanNui(result.fields.optional1))) return null;
    return { fields: result.fields, lines };
  } catch {
    return null;
  }
}

async function preprocess(cardBuffer, meta, [start, size], width, mode) {
  const top = Math.round(meta.height * start);
  let image = sharp(cardBuffer)
    .extract({ left: 0, top, width: meta.width, height: Math.min(meta.height - top, Math.round(meta.height * size)) })
    .greyscale()
    .resize({ width, kernel: 'lanczos3' });
  if (mode === 'norm') image = image.normalise().sharpen();
  return image.png().toBuffer();
}

/**
 * Lee la MRZ de una foto del reverso (ya recortada a la tarjeta). Con muchos intentos, una lectura
 * errónea puede pasar los dígitos de control por azar: se acepta cuando dos intentos coinciden en
 * los campos protegidos o, con una sola lectura, cuando su NUI es exactamente la cédula registrada.
 * @param {Buffer} cardBuffer
 * @param {{expectedNui?: string}} [options]
 * @returns {Promise<{leida: boolean, consenso?: boolean, datos?: object, intentos: number}>}
 */
async function readMrz(cardBuffer, { expectedNui = null } = {}) {
  const worker = await getWorker();
  const meta = await sharp(cardBuffer).metadata();
  const votes = new Map();
  let intentos = 0;
  let sawMrzLikeText = false;

  for (const zone of ZONES) {
    for (const width of SCALES) {
      for (const mode of MODES) {
        intentos += 1;
        // Sin nada parecido a una MRZ en los primeros intentos (cédula antigua): no insistir
        if (intentos > 6 && !sawMrzLikeText) return { leida: false, intentos };

        const { data } = await worker.recognize(await preprocess(cardBuffer, meta, zone, width, mode));
        // Se mira el texto tal como se leyó: candidateLines rellena con '<' las líneas cortas
        if (/<<<|ECU/.test(data.text)) sawMrzLikeText = true;
        const lines = candidateLines(data.text);

        const reading = parseTd1(lines);
        if (!reading) continue;
        const key = PROTECTED_FIELDS.map((f) => reading.fields[f]).join('|');
        const vote = votes.get(key) || { ...reading, count: 0 };
        vote.count += 1;
        votes.set(key, vote);

        if (vote.count >= 2 || (expectedNui && cleanNui(reading.fields.optional1) === expectedNui)) {
          return {
            leida: true,
            consenso: vote.count >= 2,
            datos: datosFromFields(vote.fields, vote.lines),
            intentos,
          };
        }
      }
    }
  }
  return { leida: false, intentos };
}

module.exports = {
  PROTECTED_FIELDS,
  cleanNui,
  mrzDate,
  datosFromFields,
  candidateLines,
  parseTd1,
  readMrz,
};
