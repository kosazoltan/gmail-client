// PWA ikon generáló script - sharp-pal
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '../public/icons');

// Icons mappa létrehozása
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Alap ikon SVG (512x512 mérethez optimalizálva)
const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="64" fill="#3B82F6"/>
  <g transform="translate(64, 96) scale(8)">
    <rect x="4" y="10" width="40" height="28" rx="3" fill="#1E40AF"/>
    <path d="M4 13L24 26L44 13" stroke="#1E3A8A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 18H32L16 30H32" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

// Maskable ikon (safe zone figyelembe vételével - 40% padding)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" fill="#3B82F6"/>
  <g transform="translate(128, 160) scale(5.3333)">
    <rect x="4" y="10" width="40" height="28" rx="3" fill="#1E40AF"/>
    <path d="M4 13L24 26L44 13" stroke="#1E3A8A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 18H32L16 30H32" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('PWA ikonok generálása...');

  // Alap ikonok generálása
  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(Buffer.from(baseSvg))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✓ ${outputPath}`);
  }

  // Maskable ikonok generálása
  for (const size of [192, 512]) {
    const outputPath = path.join(iconsDir, `icon-maskable-${size}x${size}.png`);
    await sharp(Buffer.from(maskableSvg))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✓ ${outputPath}`);
  }

  // Apple touch icon
  const appleTouchPath = path.join(iconsDir, 'apple-touch-icon.png');
  await sharp(Buffer.from(baseSvg))
    .resize(180, 180)
    .png()
    .toFile(appleTouchPath);
  console.log(`✓ ${appleTouchPath}`);

  // Favicon 32x32
  const favicon32Path = path.join(iconsDir, 'favicon-32x32.png');
  await sharp(Buffer.from(baseSvg))
    .resize(32, 32)
    .png()
    .toFile(favicon32Path);
  console.log(`✓ ${favicon32Path}`);

  // Favicon 16x16
  const favicon16Path = path.join(iconsDir, 'favicon-16x16.png');
  await sharp(Buffer.from(baseSvg))
    .resize(16, 16)
    .png()
    .toFile(favicon16Path);
  console.log(`✓ ${favicon16Path}`);

  console.log('\\nPWA ikonok sikeresen létrehozva!');
}

generateIcons().catch(console.error);
