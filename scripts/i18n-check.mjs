/**
 * Lists every English UI string and reports, per language, which ones have no
 * translation yet.
 *
 *   node scripts/i18n-check.mjs            report missing translations
 *   node scripts/i18n-check.mjs --list     print all source strings (JSON)
 *
 * Sources:
 *   1. every t('…') / tr('…') call in app/ and src/
 *   2. string data that is translated later through t(variable): document
 *      types and categories, field labels, scanner hints, PIN rules, etc.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'i18n') walk(p, out);
    } else if (/\.(tsx?|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const unescape = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
const strings = new Set();

// 1. t('…') calls (first argument, single or double quotes, may start on the next line)
const CALL = /\b(?:t|tr)\(\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g;
for (const file of [...walk(path.join(root, 'app')), ...walk(path.join(root, 'src'))]) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(CALL)) if (m[2].trim()) strings.add(unescape(m[2]));
}

// 2. data translated through t(variable)
const DATA_FILES = [
  'src/vault/categories.ts',
  'src/scan/extract.ts',
  'src/scan/capture.ts',
  'src/crypto/core.ts',

  'src/vault/VaultContext.tsx',
  'src/vault/keyManager.ts',
  'src/security/importers.ts',
  'src/i18n/index.ts',
  'src/content/legal.ts',
  'src/components/GuidedCamera.tsx',
  'app/onboarding/index.tsx',
  'app/onboarding/biometrics.tsx',
  'app/onboarding/finish.tsx',
  'app/(vault)/settings/security.tsx',
  'app/(vault)/settings/protection.tsx',
  'app/(vault)/settings/about.tsx',
  'app/(vault)/settings/appearance.tsx',
  'app/(vault)/settings/rights.tsx',
];
const DATA_KEYS = /(?:label|hint|name|title|body|text|message|english|description|problem)\s*:\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const PAIRS = /\[\s*'[A-Za-z_]+'\s*,\s*'([^'\n]+)'\s*\]/g; // ['key', 'Label'] templates
const SLOTS = /"slots":\s*\[([^\]]*)\]|slots:\s*\[([^\]]*)\]/g;
const RETURNS = /return\s+'([A-Z][^'\n]+)'/g; // validatePin messages
const IMPORT_ERR = /new ImportError\('([^'\n]+)'\)/g;
const HINTS = /setHint\('([^'\n]+)'\)|useState\('([A-Z][^'\n]+)'\)|BIO_PROMPT = '([^'\n]+)'/g;
const LIST_ITEMS = /^\s*'([A-Z][^'\n]{3,})',\s*$/gm; // string arrays such as setup steps
const TUPLES = /^\s*\['([A-Z][^'\n]+)',\s*'([^'\n]+)'\],?\s*$/gm; // [title, body] / [spec, value]
const JSON_KEYS = /"(?:label|hint|name|description)":\s*"([^"\n]+)"/g;

for (const rel of DATA_FILES) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  const add = (s) => s && /[A-Za-z]{2}/.test(s) && !/^[a-z_]+$/.test(s) && !/^[a-z]+(-[a-z]+)+$/.test(s) && strings.add(unescape(s));
  if (rel.endsWith('legal.ts')) {
    // only the document titles; the legal body text stays in English
    for (const m of src.matchAll(/title: '([^']+)'/g)) add(m[1]);
    continue;
  }
  for (const m of src.matchAll(DATA_KEYS)) add(m[2]);
  for (const m of src.matchAll(JSON_KEYS)) add(m[1]);
  for (const m of src.matchAll(PAIRS)) add(m[1]);
  for (const m of src.matchAll(SLOTS)) for (const s of (m[1] ?? m[2]).matchAll(/["']([^"']+)["']/g)) add(s[1]);
  for (const m of src.matchAll(RETURNS)) add(m[1]);
  for (const m of src.matchAll(IMPORT_ERR)) add(m[1]);
  for (const m of src.matchAll(HINTS)) add(m[1] ?? m[2] ?? m[3]);
  for (const m of src.matchAll(LIST_ITEMS)) add(m[1]);
  for (const m of src.matchAll(TUPLES)) {
    add(m[1]);
    add(m[2]);
  }
}

// Strings built at run time that the patterns above cannot see
for (const s of ['Page {n}', 'Face ID', 'Touch ID', 'Face or fingerprint', 'Face unlock', 'Fingerprint']) strings.add(s);

// Technical values that are never shown translated
for (const s of ['AES-256-GCM', 'AES-256-GCM (authenticated)', 'Platform CSPRNG']) strings.delete(s);

const all = [...strings].sort((a, b) => a.localeCompare(b));

if (process.argv.includes('--list')) {
  console.log(JSON.stringify(all, null, 1));
  process.exit(0);
}

const langs = ['ar', 'es', 'fr', 'de', 'it', 'pt'];
let missingTotal = 0;
for (const lang of langs) {
  const file = path.join(root, 'src/i18n', `${lang}.ts`);
  const src = fs.readFileSync(file, 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/^\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1\s*:/gm)) keys.add(unescape(m[2]));
  const missing = all.filter((s) => !keys.has(s));
  missingTotal += missing.length;
  console.log(`${lang}: ${all.length - missing.length}/${all.length} translated`);
  if (process.argv.includes('--verbose')) for (const s of missing) console.log('   - ' + JSON.stringify(s));
}
console.log(`${all.length} source strings`);
process.exitCode = missingTotal ? 1 : 0;
