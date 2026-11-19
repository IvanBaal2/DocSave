/**
 * Copies the pdf.js library + worker into assets/pdfjs/ as plain-text assets.
 * They ship inside the app (fully offline) but are NOT part of the JavaScript
 * bundle, so they do not slow down app start; the viewer loads them only
 * when a PDF is opened. Runs automatically on `npm install` (postinstall).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build');
const outDir = path.join(root, 'assets', 'pdfjs');

try {
  fs.mkdirSync(outDir, { recursive: true });
  const version = require(path.join(root, 'node_modules', 'pdfjs-dist', 'package.json')).version;
  fs.copyFileSync(path.join(buildDir, 'pdf.min.mjs'), path.join(outDir, 'pdf.txt'));
  fs.copyFileSync(path.join(buildDir, 'pdf.worker.min.mjs'), path.join(outDir, 'pdf.worker.txt'));
  fs.writeFileSync(path.join(outDir, 'VERSION'), version + '\n');
  // Remove the old in-bundle copy if present.
  const legacy = path.join(root, 'src', 'viewer', 'pdfjsSource.generated.js');
  if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
  console.log(`pdf.js ${version} copied to assets/pdfjs (loaded on demand)`);
} catch (e) {
  console.warn('[bundle-pdfjs] skipped:', e.message);
}
