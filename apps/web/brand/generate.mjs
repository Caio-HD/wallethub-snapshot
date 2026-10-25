#!/usr/bin/env node
/**
 * WalletHub brand asset pipeline.
 *
 * Single source of truth: `brand/source/mark.svg` (vector) + `brand/fonts/*`.
 * Everything raster in `public/brand/` is generated from them here — icons,
 * maskable, favicon, og-image, logo-full lockup and the PWA manifest. The
 * wordmark is outlined to vector paths with opentype.js, so the output is fully
 * reproducible and does NOT depend on any system-installed font. Re-run after
 * editing the mark:
 *
 *     npm run brand:generate
 *
 * Requires `sharp` + `opentype.js` (devDependencies). Node 18 → sharp ^0.32.
 */
import sharp from 'sharp';
import opentype from 'opentype.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/brand');
fs.mkdirSync(OUT, { recursive: true });

const fontBold = opentype.loadSync(path.resolve(__dirname, 'fonts/Montserrat-Bold.ttf'));
const fontRegular = opentype.loadSync(path.resolve(__dirname, 'fonts/Montserrat-Regular.ttf'));

// ---- brand tokens -----------------------------------------------------------
const NAVY = '#0D1530';
const NAVY_DEEP = '#0A1120';
const TEXT_LIGHT = '#EAF0FF';
const TEXT_DARK = '#0D1530';
const ACCENT = '#22D3EE';
const ACCENT_ON_LIGHT = '#0E9CC0';
const SUBTLE = '#9FB0C9';

// The mark, parametrised so it can be drawn standalone or inside a frame.
const markInner = `
  <defs>
    <linearGradient id="wh-grad" x1="126" y1="350" x2="396" y2="150" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2F6BFF"/><stop offset="1" stop-color="${ACCENT}"/>
    </linearGradient>
  </defs>
  <path d="M126 176 L186 350 L256 236 L322 350 L392 158" stroke="url(#wh-grad)" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M344 166 L392 158 L400 206" stroke="${ACCENT}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
const markSvg = () => `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">${markInner}</svg>`;
const markBuf = Buffer.from(markSvg());

/** Outline arbitrary text to a tight-bbox vector SVG (font-independent). */
function textSvg(font, text, fontSize, color) {
  const p = font.getPath(text, 0, 0, fontSize);
  const b = p.getBoundingBox();
  const w = Math.ceil(b.x2 - b.x1);
  const h = Math.ceil(b.y2 - b.y1);
  return `<svg width="${w}" height="${h}" viewBox="${b.x1} ${b.y1} ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><path d="${p.toPathData(2)}" fill="${color}"/></svg>`;
}

/** "Wallet" + accented "Hub" outlined into one two-colour vector SVG. */
function wordmarkSvg(textColor, accent, fontSize = 120) {
  const p1 = fontBold.getPath('Wallet', 0, 0, fontSize);
  const adv = fontBold.getAdvanceWidth('Wallet', fontSize);
  const p2 = fontBold.getPath('Hub', adv, 0, fontSize);
  const b1 = p1.getBoundingBox();
  const b2 = p2.getBoundingBox();
  const x1 = Math.min(b1.x1, b2.x1), y1 = Math.min(b1.y1, b2.y1);
  const x2 = Math.max(b1.x2, b2.x2), y2 = Math.max(b1.y2, b2.y2);
  const w = Math.ceil(x2 - x1), h = Math.ceil(y2 - y1);
  return `<svg width="${w}" height="${h}" viewBox="${x1} ${y1} ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <path d="${p1.toPathData(2)}" fill="${textColor}"/>
    <path d="${p2.toPathData(2)}" fill="${accent}"/></svg>`;
}

async function iconOnFrame(size, { round = true } = {}) {
  const rx = round ? Math.round(size * 0.225) : 0;
  const frame = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${rx}" fill="${NAVY}"/></svg>`);
  const mark = await sharp(markBuf).resize(Math.round(size * 0.62), Math.round(size * 0.62), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp(frame).composite([{ input: mark, gravity: 'center' }]).png();
}

async function write(name, pipeline) {
  await pipeline.toFile(path.join(OUT, name));
  console.log('  ✓', name);
}

async function main() {
  console.log('Generating brand assets →', OUT);

  for (const s of [128, 256, 512]) {
    await write(`mark-${s}.png`, sharp(markBuf).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png());
  }
  await write('mark-512.webp', sharp(markBuf).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }));
  await write('favicon-32.png', sharp(markBuf).resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png());

  await write('apple-touch-icon.png', await iconOnFrame(180));
  await write('icon-192.png', await iconOnFrame(192));
  await write('icon-512.png', await iconOnFrame(512));

  {
    const bg = Buffer.from(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="${NAVY}"/></svg>`);
    const mark = await sharp(markBuf).resize(280, 280, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await write('icon-maskable-512.png', sharp(bg).composite([{ input: mark, gravity: 'center' }]).png());
  }

  async function logoFull(suffix, textColor, accent) {
    const markH = 132;
    const mark = await sharp(markBuf).resize(markH, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const wmH = 96;
    const wm = await sharp(Buffer.from(wordmarkSvg(textColor, accent, 120))).resize({ height: wmH }).png().toBuffer();
    const wmMeta = await sharp(wm).metadata();
    const gap = 30;
    const W = markH + gap + wmMeta.width;
    const H = 168;
    const composed = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: mark, left: 0, top: Math.round((H - markH) / 2) },
        { input: wm, left: markH + gap, top: Math.round((H - wmH) / 2) },
      ])
      .png()
      .toBuffer();
    const trimmed = sharp(composed).trim();
    await write(`logo-full${suffix}.png`, trimmed.clone().png());
    await write(`logo-full${suffix}.webp`, trimmed.clone().webp({ quality: 92 }));
    return sharp(await trimmed.png().toBuffer()).metadata();
  }
  const lightMeta = await logoFull('', TEXT_LIGHT, ACCENT);
  await logoFull('-dark', TEXT_DARK, ACCENT_ON_LIGHT);
  const aspectRatio = +(lightMeta.width / lightMeta.height).toFixed(3);

  {
    const W = 1200, H = 630;
    const bg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="b" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${NAVY_DEEP}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient></defs>
        <rect width="${W}" height="${H}" fill="url(#b)"/></svg>`);
    const markH = 168;
    const mark = await sharp(markBuf).resize(markH, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const wmH = 104;
    const wm = await sharp(Buffer.from(wordmarkSvg(TEXT_LIGHT, ACCENT, 130))).resize({ height: wmH }).png().toBuffer();
    const wmMeta = await sharp(wm).metadata();
    const sub = await sharp(Buffer.from(textSvg(fontRegular, 'Suas finanças num só lugar.', 40, SUBTLE))).png().toBuffer();
    const subMeta = await sharp(sub).metadata();
    const gap = 34;
    const groupW = markH + gap + wmMeta.width;
    const left = Math.round((W - groupW) / 2);
    const top = 212;
    await write('og-image.png', sharp(bg).composite([
      { input: mark, left, top },
      { input: wm, left: left + markH + gap, top: top + Math.round((markH - wmH) / 2) },
      { input: sub, left: Math.round((W - subMeta.width) / 2), top: 472 },
    ]).png());
  }

  const manifest = {
    name: 'WalletHub',
    short_name: 'WalletHub',
    description: 'Suas finanças num só lugar.',
    theme_color: NAVY,
    background_color: NAVY_DEEP,
    display: 'standalone',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('  ✓ manifest.json');
  console.log('logo-full aspectRatio =', aspectRatio);
}

main().catch((e) => { console.error(e); process.exit(1); });
