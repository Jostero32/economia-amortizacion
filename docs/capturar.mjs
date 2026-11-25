// Capturas de pantalla reproducibles para los README y el portafolio.
// Uso: node capturar.mjs <config.json> <carpeta-salida>
// config.json: { "viewport": {"width":1440,"height":900}, "colorScheme": "light",
//   "shots": [ { "name": "panel", "url": "http://...", "click": ["Texto de botón", "?Opcional"], "waitFor": "selector", "fullPage": false } ] }
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [configPath, outDir] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: cfg.viewport ?? { width: 1440, height: 900 },
  deviceScaleFactor: cfg.deviceScaleFactor ?? 1,
  colorScheme: cfg.colorScheme ?? 'light',
  locale: 'es-EC',
  timezoneId: 'America/Guayaquil',
});
const page = await context.newPage();

for (const shot of cfg.shots) {
  try {
    if (shot.viewport) await page.setViewportSize(shot.viewport); // tamaño propio de esta captura
    else await page.setViewportSize(cfg.viewport ?? { width: 1440, height: 900 });
    await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 30000 });
    // "?Texto" = clic opcional: se omite si el botón no existe (p. ej. ya se calculó antes).
    for (const raw of shot.click ?? []) {
      const optional = raw.startsWith('?');
      const text = optional ? raw.slice(1) : raw;
      const btn = page.getByRole('button', { name: text, exact: false }).first();
      if (optional && !(await btn.isVisible().catch(() => false))) continue;
      await btn.click();
      await page.waitForLoadState('networkidle');
    }
    if (shot.waitFor) await page.waitForSelector(shot.waitFor, { timeout: 10000 });
    await page.waitForTimeout(shot.delay ?? 600);
    const file = join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: shot.fullPage ?? false });
    console.log('ok   ', shot.name);
  } catch (e) {
    console.log('FALLO', shot.name, '-', e.message.split('\n')[0]);
  }
}
await browser.close();
