/**
 * Builds every app / store image from the master logo
 * (assets/brand/docsave-logo-source.png).
 *
 *   npm run brand
 *
 * The master logo contains a frame and small text, which become unreadable at
 * home-screen size and clash with the rounded masks iOS and Android apply. So
 * the app icon uses only the artwork (folder, ID card, passport, shield) on a
 * matching dark gradient; the full logo is used where there is room for it.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const SRC = path.join(root, 'assets', 'brand', 'docsave-logo-source.png');
const A = (...p) => path.join(root, 'assets', ...p);

// Regions of the 1254×1254 master logo.
const ART = { left: 160, top: 92, width: 975, height: 675 }; // folder + documents + shield + ring
const WORDMARK = { left: 92, top: 785, width: 1070, height: 320 }; // "Docsave" + divider + tagline

const BG_CENTER = '#011630';
const BG_EDGE = '#000a17';
const BG_FLAT = '#000b1a'; // matches the logo's inner background (used for adaptive icon / splash)

function gradientSvg(w, h, cx = 0.5, cy = 0.42, r = 0.75) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="${r}">
        <stop offset="0" stop-color="${BG_CENTER}"/><stop offset="1" stop-color="${BG_EDGE}"/>
      </radialGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`,
  );
}

/** Soft-edged alpha mask so a crop blends into the background without seams. */
function featherMask(w, h, feather) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><filter id="b"><feGaussianBlur stdDeviation="${feather / 2}"/></filter></defs>
      <rect x="${feather}" y="${feather}" width="${w - feather * 2}" height="${h - feather * 2}"
            rx="${feather * 2}" fill="#fff" filter="url(#b)"/>
    </svg>`,
  );
}

async function feathered(region, width, feather) {
  const height = Math.round((region.height / region.width) * width);
  const crop = await sharp(SRC).extract(region).resize(width, height).ensureAlpha().png().toBuffer();
  const mask = await sharp(featherMask(width, height, feather)).resize(width, height).png().toBuffer();
  return {
    buffer: await sharp(crop).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(),
    width,
    height,
  };
}

async function onGradient(w, h, layers, opts) {
  const base = sharp(gradientSvg(w, h, opts?.cx, opts?.cy, opts?.r)).resize(w, h);
  return base.composite(layers).flatten({ background: BG_EDGE });
}

async function iconWithArt(size, artWidth, yOffset = 0) {
  const art = await feathered(ART, artWidth, Math.round(artWidth * 0.06));
  return onGradient(size, size, [
    {
      input: art.buffer,
      left: Math.round((size - art.width) / 2),
      top: Math.round((size - art.height) / 2 + yOffset),
    },
  ]);
}

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Missing master logo: ${SRC}`);
  fs.mkdirSync(A('store'), { recursive: true });

  // iOS / default app icon: opaque, no transparency (App Store requirement).
  await (await iconWithArt(1024, 900, 10)).removeAlpha().png().toFile(A('icon.png'));

  // Android adaptive icon foreground: artwork inside the 66 % safe zone.
  await (await iconWithArt(1024, 600, 6)).removeAlpha().png().toFile(A('adaptive-icon.png'));

  // Play Store hi-res icon.
  await (await iconWithArt(512, 450, 5)).removeAlpha().png().toFile(A('store', 'play-icon-512.png'));

  // In-app logo mark (rounded in the UI).
  await (await iconWithArt(256, 225, 2)).removeAlpha().png().toFile(A('brand', 'logo-mark.png'));

  // Full logo for splash + welcome screen, outer black corners made transparent.
  const full = 900;
  const corner = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${full}" height="${full}">
      <rect x="4" y="4" width="${full - 8}" height="${full - 8}" rx="${full * 0.2}" fill="#fff"/>
    </svg>`,
  );
  await sharp(SRC)
    .resize(full, full)
    .ensureAlpha()
    .composite([{ input: corner, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(A('brand', 'logo-full.png'));


  // Play Store feature graphic 1024×500: artwork left, wordmark + tagline right.
  const art = await feathered(ART, 470, 28);
  const word = await feathered(WORDMARK, 500, 8);
  await (
    await onGradient(
      1024,
      500,
      [
        { input: art.buffer, left: 40, top: Math.round((500 - art.height) / 2) },
        { input: word.buffer, left: 500, top: Math.round((500 - word.height) / 2) + 6 },
      ],
      { cx: 0.3, cy: 0.45, r: 0.9 },
    )
  )
    .removeAlpha()
    .png()
    .toFile(A('store', 'play-feature-graphic-1024x500.png'));

  // Splash icon: artwork only, transparent background (the splash background
  // colour comes from app.config.js), sized for the Android 12+ splash icon.
  {
    const size = 1024;
    const art = await feathered(ART, 760, 40);
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: art.buffer, left: Math.round((size - art.width) / 2), top: Math.round((size - art.height) / 2) }])
      .png()
      .toFile(A('splash-icon.png'));
  }

  // Website logo.
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  await sharp(A('brand', 'logo-mark.png')).resize(128, 128).png().toFile(path.join(root, 'docs', 'logo.png'));

  console.log('Brand assets written: icon, adaptive-icon, splash, brand/*, store/*, docs/logo.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
