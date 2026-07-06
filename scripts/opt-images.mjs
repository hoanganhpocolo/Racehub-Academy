import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'public/assets/images';
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
let before = 0, after = 0;

function size(p) { return fs.statSync(p).size; }

// 1) Re-encode JPG/JPEG in place (cap width 1600, quality 72).
const jpgs = fs.readdirSync(DIR).filter((f) => /\.(jpe?g)$/i.test(f));
for (const f of jpgs) {
  const p = path.join(DIR, f);
  const b0 = size(p);
  const buf = await sharp(p).rotate().resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true }).toBuffer();
  if (buf.length < b0) { fs.writeFileSync(p, buf); }
  const b1 = size(p);
  before += b0; after += b1;
  console.log(`jpg  ${f}: ${kb(b0)} -> ${kb(b1)}`);
}

// 2) Convert heavy PNGs to WebP (new file; caller updates refs, old removed later).
const toWebp = [
  { src: 'hero-bg.png', out: 'hero-bg.webp', width: 1440, q: 82 },
  { src: 'coach 3.png', out: 'coach 3.webp', width: 900, q: 80 },
  { src: 'sketch.png', out: 'sketch.webp', q: 88 },      // used in scratch canvas
  { src: 'real.png', out: 'real.webp', q: 88 },          // used in scratch canvas
  { src: 'overlay.png', out: 'overlay.webp', q: 80 },    // repeating CSS texture (keep dims)
];
for (const { src, out, width, q } of toWebp) {
  const ps = path.join(DIR, src);
  if (!fs.existsSync(ps)) { console.log(`skip ${src} (missing)`); continue; }
  const b0 = size(ps);
  let img = sharp(ps);
  if (width) img = img.resize({ width, withoutEnlargement: true });
  await img.webp({ quality: q }).toFile(path.join(DIR, out));
  const b1 = size(path.join(DIR, out));
  before += b0; after += b1;
  console.log(`webp ${src} -> ${out}: ${kb(b0)} -> ${kb(b1)}`);
}

// 3) Re-encode remaining PNGs in place (gear, misc) — keep transparency.
const skip = new Set(['hero-bg.png', 'coach 3.png', 'sketch.png', 'real.png', 'overlay.png',
  'Logo.svg', 'Logo-animated.svg', 'vortexlogo.webp', 'vortexlogo-trim.png']);
const pngs = fs.readdirSync(DIR).filter((f) => /\.png$/i.test(f) && !skip.has(f));
for (const f of pngs) {
  const p = path.join(DIR, f);
  const b0 = size(p);
  const buf = await sharp(p).resize({ width: 1200, withoutEnlargement: true })
    .png({ quality: 80, compressionLevel: 9, palette: true }).toBuffer();
  if (buf.length < b0) { fs.writeFileSync(p, buf); }
  const b1 = size(p);
  before += b0; after += b1;
  console.log(`png  ${f}: ${kb(b0)} -> ${kb(b1)}`);
}

console.log(`\nTOTAL: ${kb(before)} -> ${kb(after)}  (saved ${kb(before - after)})`);
