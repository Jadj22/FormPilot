/**
 * scripts/generate-icons.mjs
 * Rasterise public/icons/icon.svg → public/icons/icon-{16,32,48,128}.png
 * Usage: node scripts/generate-icons.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svgPath = resolve(root, 'public', 'icons', 'icon.svg');
const svgData = readFileSync(svgPath, 'utf8');

const SIZES = [16, 32, 48, 128];

for (const size of SIZES) {
  const resvg = new Resvg(svgData, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  });
  const png = resvg.render().asPng();
  const out = resolve(root, 'public', 'icons', `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`✓ icon-${size}.png (${png.length} bytes)`);
}

console.log('Icons generated successfully.');
