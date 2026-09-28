// Calibración de la verificación de identidad con cédulas reales (fase 0).
//
// Uso:  npm install && npm run calibrar -- <carpeta con las fotos>
//
// La carpeta debe estar FUERA del repositorio: las cédulas son datos personales. El informe solo
// muestra estadísticas (distancias, validaciones y tiempos), nunca nombres ni números de cédula.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { parse } from 'mrz';

const require = createRequire(import.meta.url);
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const { isValidCedula } = require('../../backend/src/utils/identity.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');

// Deben coincidir con backend/src/config/identity.js (umbrales en uso)
const MATCH_DISTANCE = 0.5;
const DOUBTFUL_DISTANCE = 0.6;

// Modelo MRZ de tesseractMRZ (licencia BSD-3), fijado a un commit y verificado por hash
const MRZ_MODEL_URL = 'https://raw.githubusercontent.com/DoubangoTelecom/tesseractMRZ/0f039b6d18a4a0e7adb0b4841a8732e200b8d968/tessdata_fast/mrz.traineddata';
const MRZ_MODEL_SHA256 = 'ece2a54f125a73792f9cec74e6f8e62f6e5e00c7f19153ba865af689be5b5f01';
const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
// Zona MRZ en el reverso (fracción del alto de la tarjeta: inicio, alto), con variantes por inclinación
const MRZ_ZONES = [[0.62, 0.35], [0.58, 0.40], [0.66, 0.31]];
// Campos cubiertos por dígitos de control en TD1. El dígito compuesto salta el sexo y la nacionalidad,
// y los nombres de la línea 3 no tienen control: esos se comparan con tolerancia, no se confían.
const PROTECTED_FIELDS = ['documentNumber', 'optional1', 'birthDate', 'expirationDate', 'optional2'];

// ---------------------------------------------------------------------------------------------
// Archivos: <documento>-<anverso|reverso|selfie>[-variante].<jpg|jpeg|png|webp>
// La persona es el texto antes de "_" en <documento> (p2_antigua → p2). Para agrupar documentos con
// otro nombre (la cédula antigua y la nueva de la misma persona): --persona antigua=p2
// ---------------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const aliases = {};
const positional = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--persona' && args[i + 1]?.includes('=')) {
    const [doc, persona] = args[i + 1].split('=');
    aliases[doc] = persona;
    i += 1;
  } else {
    positional.push(args[i]);
  }
}
const folder = positional[0] && resolve(positional[0]);
if (!folder || !existsSync(folder)) {
  console.error('Uso: npm run calibrar -- <carpeta con las fotos> [--persona documento=persona]');
  process.exit(1);
}
const insideRepo = relative(REPO, folder);
if (insideRepo === '' || (!insideRepo.startsWith('..') && !isAbsolute(insideRepo))) {
  console.error('La carpeta está dentro del repositorio. Muévala fuera: las cédulas son datos personales.');
  process.exit(1);
}

const NAME = /^(?<doc>[^-]+)-(?<tipo>anverso|reverso|selfie)(?:-[^.]*)?\.(?:jpe?g|png|webp)$/i;
const items = [];
const duplicates = [];
const hashes = new Set();
for (const file of readdirSync(folder).sort()) {
  const match = file.match(NAME);
  if (!match) continue;
  const hash = createHash('sha256').update(readFileSync(join(folder, file))).digest('hex');
  if (hashes.has(hash)) { duplicates.push(file); continue; }
  hashes.add(hash);
  const { doc } = match.groups;
  items.push({ file, doc, persona: aliases[doc] || doc.split('_')[0], tipo: match.groups.tipo.toLowerCase() });
}
const personas = new Set(items.map((item) => item.persona));
console.log(`Imágenes: ${items.length} de ${personas.size} persona(s)${duplicates.length ? ` · duplicadas omitidas: ${duplicates.join(', ')}` : ''}`);

// ---------------------------------------------------------------------------------------------
// Imagen
// ---------------------------------------------------------------------------------------------
const load = (path) => sharp(path).rotate(); // aplica la orientación EXIF

async function rgb(pipeline) {
  const { data, info } = await pipeline.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels === 3) return { data, width: info.width, height: info.height };
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0; i < info.width * info.height; i += 1) out.fill(data[i * info.channels], i * 3, i * 3 + 3);
  return { data: out, width: info.width, height: info.height };
}

async function withMargin(pipeline, ratio = 0.35) {
  const { width, height } = await rgb(pipeline);
  const dx = Math.round(width * ratio);
  const dy = Math.round(height * ratio);
  return sharp(await pipeline.clone().extend({ top: dy, bottom: dy, left: dx, right: dx, background: '#808080' }).toBuffer());
}

/** Caja de la tarjeta: mayor componente claro de la imagen (la cédula es clara sobre el fondo). */
async function cardBox(pipeline) {
  const { width: fullWidth, height: fullHeight } = await rgb(pipeline);
  const { data, info } = await pipeline.clone().greyscale().resize({ width: 320 }).blur(1.5).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const mask = new Uint8Array(w * h);
  // Claro y dilatado 3x3 para cerrar los huecos del texto impreso
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      let bright = 0;
      for (let dy = -1; dy <= 1 && !bright; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (data[(y + dy) * w + x + dx] > 150) { bright = 1; break; }
      mask[y * w + x] = bright;
    }
  }
  const seen = new Uint8Array(w * h);
  let best = null;
  for (let start = 0; start < w * h; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    const box = { n: 0, x0: w, y0: h, x1: 0, y1: 0 };
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      box.n += 1;
      box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
      box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q >= 0 && q < w * h && mask[q] && !seen[q] && Math.abs((q % w) - x) <= 1) { seen[q] = 1; stack.push(q); }
      }
    }
    if (!best || box.n > best.n) best = box;
  }
  const k = fullWidth / w;
  const left = Math.max(0, Math.round(best.x0 * k));
  const top = Math.max(0, Math.round(best.y0 * k));
  return {
    left, top,
    width: Math.min(fullWidth - left, Math.round((best.x1 - best.x0 + 1) * k)),
    height: Math.min(fullHeight - top, Math.round((best.y1 - best.y0 + 1) * k)),
  };
}

/** Varianza del Laplaciano de la zona MRZ con la tarjeta normalizada a 800 px (mayor = más nítida). */
async function sharpness(cardBuffer) {
  const resized = await sharp(cardBuffer).resize({ width: 800 }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = resized;
  const w = info.width;
  const y0 = Math.round(info.height * 0.62);
  const y1 = Math.round(info.height * 0.97);
  let sum = 0; let sum2 = 0; let n = 0;
  for (let y = Math.max(1, y0); y < Math.min(info.height - 1, y1); y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const lap = data[i - 1] + data[i + 1] + data[i - w] + data[i + w] - 4 * data[i];
      sum += lap; sum2 += lap * lap; n += 1;
    }
  }
  return sum2 / n - (sum / n) ** 2;
}

// ---------------------------------------------------------------------------------------------
// Rostros
// ---------------------------------------------------------------------------------------------
async function detect(pipeline) {
  const { data, width, height } = await rgb(pipeline);
  const tensor = faceapi.tf.tensor3d(new Uint8Array(data), [height, width, 3], 'int32');
  try {
    for (const minConfidence of [0.4, 0.2]) {
      const found = await faceapi.detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence }))
        .withFaceLandmarks().withFaceDescriptors();
      if (found.length) {
        return found.sort((a, b) => b.detection.box.area - a.detection.box.area)
          .map((f) => ({ descriptor: f.descriptor, score: f.detection.score }));
      }
    }
    return [];
  } finally {
    tensor.dispose();
  }
}

/** Rostro principal (el más grande); si no aparece, reintenta con margen alrededor de la foto. */
async function mainFace(pipeline) {
  let faces = await detect(pipeline);
  if (faces.length) return { ...faces[0], strategy: 'completa' };
  faces = await detect(await withMargin(pipeline));
  return faces.length ? { ...faces[0], strategy: 'con margen' } : null;
}

const distance = (a, b) => Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0));
const band = (d) => (d <= MATCH_DISTANCE ? 'coincide' : d <= DOUBTFUL_DISTANCE ? 'dudoso' : 'no coincide');

async function faceReport() {
  await faceapi.tf.setBackend('wasm');
  await faceapi.tf.ready();
  const models = join(HERE, 'node_modules/@vladmandic/face-api/model');
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(models);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(models);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(models);

  console.log('\n== Rostros (a color, como en la comparación de la app)');
  const faces = [];
  for (const item of items.filter((i) => i.tipo !== 'reverso')) {
    const face = await mainFace(load(join(folder, item.file)));
    console.log(`  ${item.file.padEnd(34)} ${face ? `${face.strategy}, confianza ${face.score.toFixed(2)}` : 'SIN ROSTRO'}`);
    if (face) faces.push({ ...item, descriptor: face.descriptor });
  }

  const genuine = [];
  const impostor = [];
  for (let i = 0; i < faces.length; i += 1) {
    for (let j = i + 1; j < faces.length; j += 1) {
      const [a, b] = [faces[i], faces[j]];
      if (a.tipo === 'selfie' && b.tipo === 'selfie') continue;
      const d = distance(a.descriptor, b.descriptor);
      const kind = a.tipo === 'anverso' && b.tipo === 'anverso' ? 'cédula↔cédula' : 'cédula↔selfie';
      (a.persona === b.persona ? genuine : impostor).push({ d, kind, label: `${a.file} ↔ ${b.file}` });
    }
  }
  // Rostros de muestra de face-api (22 personas) como selfies de impostores
  const demo = join(HERE, 'node_modules/@vladmandic/face-api/demo');
  for (let s = 1; s <= 6; s += 1) {
    for (const face of await detect(load(join(demo, `sample${s}.jpg`)))) {
      for (const own of faces) impostor.push({ d: distance(face.descriptor, own.descriptor), kind: 'muestra', label: `muestra ${s} ↔ ${own.file}` });
    }
  }

  console.log(`\n  Misma persona (genuinos) · coincide ≤ ${MATCH_DISTANCE} · dudoso ≤ ${DOUBTFUL_DISTANCE}`);
  for (const g of genuine.sort((x, y) => x.d - y.d)) console.log(`    ${g.d.toFixed(3)}  ${band(g.d).padEnd(11)} ${g.kind.padEnd(14)} ${g.label}`);

  const ds = impostor.map((x) => x.d).sort((x, y) => x - y);
  const quantile = (p) => ds[Math.floor(p * (ds.length - 1))];
  const nearest = impostor.reduce((m, x) => (x.d < m.d ? x : m));
  const count = (list, fn) => list.filter(fn).length;
  console.log(`\n  Personas distintas (impostores): ${ds.length} pares · mínimo ${quantile(0).toFixed(3)} (${nearest.label})`
    + ` · 5 % más bajo ≤ ${quantile(0.05).toFixed(3)} · mediana ${quantile(0.5).toFixed(3)}`);
  console.log(`    en "coincide" (aceptación falsa): ${count(ds, (d) => d <= MATCH_DISTANCE)} · en "dudoso": ${count(ds, (d) => d > MATCH_DISTANCE && d <= DOUBTFUL_DISTANCE)}`);

  const relevant = genuine.filter((g) => g.kind === 'cédula↔selfie');
  if (relevant.length) {
    const worst = Math.max(...relevant.map((g) => g.d));
    console.log(`\n  Cédula↔selfie de la misma persona: ${count(relevant, (g) => g.d <= MATCH_DISTANCE)}/${relevant.length} coinciden · el más lejano ${worst.toFixed(3)}`);
    console.log(`  Un umbral de coincidencia entre ${worst.toFixed(3)} y ${quantile(0).toFixed(3)} separa ambos grupos en esta muestra`
      + `${worst >= quantile(0) ? ' (NO hay separación: los grupos se solapan)' : ''}.`);
  }
}

// ---------------------------------------------------------------------------------------------
// MRZ
// ---------------------------------------------------------------------------------------------
async function mrzModel() {
  const dir = join(HERE, 'modelos');
  const path = join(dir, 'mrz.traineddata');
  if (!existsSync(path)) {
    mkdirSync(dir, { recursive: true });
    const response = await fetch(MRZ_MODEL_URL);
    if (!response.ok) throw new Error(`No se pudo descargar el modelo MRZ (${response.status})`);
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  }
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (hash !== MRZ_MODEL_SHA256) throw new Error('El modelo MRZ descargado no coincide con el hash esperado.');
  return dir;
}

/**
 * Lee la MRZ probando zonas, escalas y preprocesos. Con muchos intentos, una lectura errónea puede
 * pasar los dígitos de control por azar (cada uno es módulo 10): solo se acepta cuando dos intentos
 * distintos coinciden en los campos protegidos (consenso).
 * @returns {{fields: object|null, attempts: number, consensus: boolean}}
 */
async function readMrz(worker, cardBuffer) {
  const meta = await sharp(cardBuffer).metadata();
  const votes = new Map();
  let attempts = 0;
  for (const [start, size] of MRZ_ZONES) {
    for (const width of [1600, 1200, 2000]) {
      for (const mode of ['plain', 'norm']) {
        attempts += 1;
        const top = Math.round(meta.height * start);
        let p = sharp(cardBuffer)
          .extract({ left: 0, top, width: meta.width, height: Math.min(meta.height - top, Math.round(meta.height * size)) })
          .greyscale().resize({ width, kernel: 'lanczos3' });
        if (mode === 'norm') p = p.normalise().sharpen();
        const { data } = await worker.recognize(await p.png().toBuffer());
        const lines = data.text.split('\n').map((t) => t.replace(/\s/g, '')).filter((t) => t.length >= 20).slice(-3);
        if (lines.length < 3) continue;
        try {
          const result = parse(lines.map((l) => (l.length >= 30 ? l.slice(0, 30) : l.padEnd(30, '<'))), { autocorrect: true });
          const nui = (result.fields.optional1 || '').replace(/</g, '');
          if (result.valid && isValidCedula(nui)) {
            const key = PROTECTED_FIELDS.map((f) => result.fields[f]).join('|');
            const vote = votes.get(key) || { fields: result.fields, count: 0 };
            vote.count += 1;
            votes.set(key, vote);
            if (vote.count >= 2) return { fields: vote.fields, attempts, consensus: true };
          }
        } catch {
          // siguiente intento
        }
      }
    }
  }
  const single = [...votes.values()][0];
  return { fields: single ? single.fields : null, attempts, consensus: false };
}

async function mrzReport() {
  const backs = items.filter((i) => i.tipo === 'reverso');
  if (!backs.length) return;
  const worker = await createWorker('mrz', 1, { langPath: await mrzModel(), gzip: false, cachePath: join(HERE, 'cache'), logger: () => {} });
  await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: MRZ_WHITELIST });

  console.log('\n== MRZ del reverso (dígitos de control + dígito verificador de la cédula + consenso)');
  const widths = [1000, 800, 650, 550, 450, 380];
  const blurs = [0, 1, 1.5, 2];
  const sharpnessLog = [];
  for (const item of backs) {
    const image = load(join(folder, item.file));
    const cardBuffer = await image.clone().extract(await cardBox(image)).toBuffer();
    const started = Date.now();
    const reference = await readMrz(worker, cardBuffer);
    const elapsed = Date.now() - started;
    const nitidez = Math.round(await sharpness(cardBuffer));
    if (!reference.consensus) {
      console.log(`  ${item.file.padEnd(34)} sin MRZ legible con consenso (cédula antigua o foto borrosa) · nitidez ${nitidez}`);
      continue;
    }
    console.log(`  ${item.file.padEnd(34)} MRZ válida con consenso en ${reference.attempts} intento(s), ${elapsed} ms · nitidez ${nitidez}`);

    // Robustez: tarjeta reducida y desenfocada (JPEG 70) → ¿misma lectura en los campos protegidos?
    let wrong = 0;
    const unprotectedDiffs = {};
    console.log(`    ancho\\σ   ${blurs.map((b) => String(b).padEnd(4)).join('')}`);
    for (const width of widths) {
      const row = [];
      for (const blur of blurs) {
        let p = sharp(cardBuffer).resize({ width });
        if (blur) p = p.blur(blur);
        const buffer = await p.jpeg({ quality: 70 }).toBuffer();
        const read = await readMrz(worker, buffer);
        const same = read.fields && PROTECTED_FIELDS.every((f) => read.fields[f] === reference.fields[f]);
        let mark = '·';
        if (read.consensus) mark = same ? '✓' : '✗';
        else if (read.fields) mark = '~';
        if (mark === '✗') wrong += 1;
        if (read.consensus) {
          for (const field of Object.keys(reference.fields)) {
            if (!PROTECTED_FIELDS.includes(field) && read.fields[field] !== reference.fields[field]) {
              unprotectedDiffs[field] = (unprotectedDiffs[field] || 0) + 1;
            }
          }
        }
        sharpnessLog.push({ value: await sharpness(buffer), mark });
        row.push(mark.padEnd(4));
      }
      console.log(`    ${String(width).padStart(5)} px ${row.join('')}`);
    }
    console.log(`    ✓ aceptada e idéntica · ~ sin consenso (se pide otra foto) · · ilegible · ✗ aceptada pero distinta (${wrong}; debe ser 0)`);
    const diffs = Object.entries(unprotectedDiffs).map(([field, n]) => `${field} ${n}`).join(', ');
    if (diffs) console.log(`    Campos sin dígito de control leídos distinto (se comparan con tolerancia): ${diffs}`);
  }
  await worker.terminate();

  // Umbral de nitidez para la captura: por debajo, la lectura deja de ser confiable
  if (sharpnessLog.length) {
    const accepted = sharpnessLog.filter((s) => s.mark === '✓').map((s) => s.value);
    const failed = sharpnessLog.filter((s) => s.mark !== '✓').map((s) => s.value);
    const rate = (min) => {
      const above = sharpnessLog.filter((s) => s.value >= min);
      return `${above.filter((s) => s.mark === '✓').length}/${above.length}`;
    };
    console.log(`\n  Nitidez (varianza del Laplaciano, tarjeta a 800 px): aceptadas desde ${Math.round(Math.min(...accepted))}`
      + `${failed.length ? ` · no aceptadas hasta ${Math.round(Math.max(...failed))}` : ''}`);
    console.log(`  Lecturas aceptadas si se exige nitidez ≥ 20: ${rate(20)} · ≥ 40: ${rate(40)} · ≥ 60: ${rate(60)} · ≥ 100: ${rate(100)}`);
  }
}

const t0 = Date.now();
await faceReport();
await mrzReport();
console.log(`\nTiempo total: ${Math.round((Date.now() - t0) / 1000)} s`);
