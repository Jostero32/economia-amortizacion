// Copia los modelos de reconocimiento facial desde node_modules a public/ para que se sirvan
// desde el mismo dominio de la aplicación (sin depender de un CDN). Se ejecuta antes de dev y build.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@vladmandic', 'face-api', 'model');
const target = join(root, 'public', 'models', 'face-api');

// Detector de rostros, puntos faciales y descriptor de 128 dimensiones
const MODELS = ['ssd_mobilenetv1_model', 'face_landmark_68_model', 'face_recognition_model'];

mkdirSync(target, { recursive: true });
for (const model of MODELS) {
  for (const file of [`${model}-weights_manifest.json`, `${model}.bin`]) {
    const destination = join(target, file);
    if (!existsSync(destination)) copyFileSync(join(source, file), destination);
  }
}
console.log('[face-api] Modelos disponibles en public/models/face-api');
