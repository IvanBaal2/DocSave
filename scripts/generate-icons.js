/**
 * Generates the Android/iOS notification icon (white shield silhouette) with
 * zero dependencies. All other app and store images come from the master logo
 * via scripts/build-brand-assets.js (npm run brand).
 *
 *   node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NAVY = [5, 8, 15];
const NAVY_2 = [14, 24, 44];
const GREEN_A = [16, 185, 129];
const GREEN_B = [52, 211, 153];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel, height = size) {
  const w = size;
  const raw = Buffer.alloc((w * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      // 2x2 supersampling for smooth edges
      let r = 0, g = 0, b = 0, a = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const p = pixel((x + ox) / w, (y + oy) / height);
        r += p[0]; g += p[1]; b += p[2]; a += p[3];
      }
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = r / 4; raw[o + 1] = g / 4; raw[o + 2] = b / 4; raw[o + 3] = a / 4;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Shield centred at (0.5, 0.5) with half-width w (unit coordinates). */
function inShield(x, y, w) {
  const top = 0.5 - w * 1.05;
  const shoulder = 0.5 - w * 0.1;
  const bottom = 0.5 + w * 1.2;
  const dx = Math.abs(x - 0.5);
  if (y < top || y > bottom) return false;
  if (y <= shoulder) {
    // gentle concave top edge
    const dip = 0.12 * w * (1 - (dx / w) ** 2);
    return dx <= w && y >= top + dip * 0.6;
  }
  const t = (y - shoulder) / (bottom - shoulder);
  return dx <= w * Math.cos((t * Math.PI) / 2) ** 0.9;
}

function inKeyhole(x, y, w) {
  const cx = 0.5, cy = 0.5 - w * 0.25;
  const r = w * 0.26;
  if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return true;
  const t = (y - cy) / (w * 0.75);
  return t >= 0 && t <= 1 && Math.abs(x - cx) <= r * (0.45 + t * 0.25);
}

function makePixel({ background, w }) {
  return (x, y) => {
    let col = background ? mix(NAVY_2, NAVY, Math.min(1, Math.hypot(x - 0.5, y - 0.35) * 1.6)) : null;
    if (inShield(x, y, w)) {
      col = inKeyhole(x, y, w) ? NAVY : mix(GREEN_B, GREEN_A, y);
    }
    return col ? [...col, 255] : [0, 0, 0, 0];
  };
}

const out = path.join(__dirname, '..', 'assets');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'notification-icon.png'), png(96, (x, y) =>
  inShield(x, y, 0.3) && !inKeyhole(x, y, 0.3) ? [255, 255, 255, 255] : [0, 0, 0, 0]));
console.log('Notification icon written to assets/');
