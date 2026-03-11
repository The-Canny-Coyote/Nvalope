#!/usr/bin/env node
/**
 * Renders public/og-image.svg to public/og-image.png (1200x630) for social sharing.
 * Run: node scripts/generate-og-image.mjs
 * Requires: npm install -D sharp
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'public', 'og-image.svg');
const pngPath = join(root, 'public', 'og-image.png');

const svg = readFileSync(svgPath);
await sharp(svg)
  .resize(1200, 630)
  .png()
  .toFile(pngPath);
console.log('Wrote', pngPath);
