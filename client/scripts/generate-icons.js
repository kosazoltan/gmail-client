// PWA ikon generáló script
// Futtatás: node scripts/generate-icons.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Egyszerű SVG -> data URI konverter (a böngészőben működik majd)
// A valódi ikonokat manuálisan kell elkészíteni vagy online tool-lal

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Alap SVG ikon
const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <rect x="4" y="10" width="40" height="28" rx="3" fill="#3B82F6"/>
  <path d="M4 13L24 26L44 13" stroke="#1E40AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 18H32L16 30H32" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse cx="38" cy="14" rx="3" ry="2" fill="white" opacity="0.3"/>
</svg>`;

// Maskable ikon (nagyobb padding-gel az adaptive icon-okhoz)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" fill="#3B82F6"/>
  <g transform="translate(26, 26) scale(1)">
    <rect x="4" y="10" width="40" height="28" rx="3" fill="#1E40AF"/>
    <path d="M4 13L24 26L44 13" stroke="#1E3A8A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 18H32L16 30H32" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const iconsDir = path.join(__dirname, '../public/icons');

// Icons directory létrehozása
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG fájlok mentése (ezeket majd PNG-re kell konvertálni)
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), baseSvg);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable.svg'), maskableSvg);

console.log('SVG ikonok létrehozva!');
console.log('');
console.log('A PNG ikonok generálásához használd az alábbi online eszközöket:');
console.log('1. https://realfavicongenerator.net/');
console.log('2. https://www.pwabuilder.com/imageGenerator');
console.log('3. https://maskable.app/editor');
console.log('');
console.log('Vagy telepítsd a sharp npm csomagot és futtasd újra.');
