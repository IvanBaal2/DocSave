/**
 * Generates the public website (GitHub Pages, /docs folder) from the exact same
 * legal text the app shows: docs/index.html, docs/privacy-policy.html,
 * docs/terms.html. The stores require a public Privacy Policy URL.
 *
 *   npm run legal:pages        (Node 23.6+ – imports the .ts file directly)
 *
 * Public URLs (GitHub Pages serves the repo root, so pages live under /docs/):
 *   https://ivanbaal2.github.io/DocSave/docs/privacy-policy.html
 *   https://ivanbaal2.github.io/DocSave/docs/terms.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTACT, PRIVACY, TERMS } from '../src/content/legal.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs');
fs.mkdirSync(out, { recursive: true });

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STYLE = `
:root{--bg:#05080F;--surface:#0E1626;--border:#1B2944;--text:#EAF0FA;--muted:#9AA8C2;--green:#34D399}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 20px 80px}
header{display:flex;align-items:center;gap:14px;margin-bottom:28px}
.mark{width:52px;height:52px;border-radius:14px;border:1px solid rgba(52,211,153,.35)}
.brand{font-size:26px;font-weight:700;letter-spacing:-.4px}.brand span{color:var(--green)}
.tag{color:var(--muted);font-size:14px;margin-top:-4px}
h1{font-size:30px;letter-spacing:-.5px;margin:8px 0 4px}
h2{color:var(--green);font-size:18px;margin:32px 0 8px}
p{color:var(--muted);margin:0 0 10px}
.meta{color:var(--muted);font-size:13px}
nav a,a{color:var(--green)}
nav{margin-top:40px;padding-top:20px;border-top:1px solid var(--border);display:flex;gap:20px;flex-wrap:wrap}
.card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:22px;margin:16px 0}
ul{color:var(--muted);padding-left:20px}`;

const shell = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Docsave</title>
<meta name="description" content="Docsave: a private, offline, encrypted document vault for Android and iOS.">
<style>${STYLE}</style></head><body><main>
<header><img class="mark" src="logo.png" alt="Docsave logo"><div><div class="brand">Doc<span>save</span></div>
<div class="tag">Your Documents. Your Device. Your Privacy.</div></div></header>
${body}
<nav><a href="index.html">Home</a><a href="privacy-policy.html">Privacy Policy</a><a href="terms.html">Terms &amp; Conditions</a></nav>
</main></body></html>
`;

function legalPage(doc) {
  const sections = doc.sections
    .map((s) => `<h2>${esc(s.heading)}</h2>\n${s.body.map((p) => `<p>${esc(p)}</p>`).join('\n')}`)
    .join('\n');
  return shell(doc.title, `<h1>${esc(doc.title)}</h1>
<p class="meta">Version ${esc(doc.version)} · Last updated ${esc(doc.updated)}</p>
${doc.status === "draft" ? `<div class="card"><p><strong>Draft — pending legal review.</strong> Items in [brackets] are still to be provided by the publisher.</p></div>` : ""}
${sections}`);
}

const home = shell('Private encrypted document vault', `<h1>Your private document vault</h1>
<p>Docsave stores your passport, ID cards, tickets and important documents encrypted on your own phone. No account, no cloud, no tracking.</p>
<div class="card"><ul>
<li>AES-256-GCM encryption on the device, before anything is saved</li>
<li>PIN, Face ID / fingerprint, or both (two-factor)</li>
<li>Nothing is uploaded, backed up or shared — there are no Docsave servers</li>
<li>No advertising, analytics or trackers</li>
<li>No recovery: only you can open your vault</li>
</ul></div>
<p>Questions or support: <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a></p>`);

fs.writeFileSync(path.join(out, 'index.html'), home);
fs.writeFileSync(path.join(out, 'privacy-policy.html'), legalPage(PRIVACY));
fs.writeFileSync(path.join(out, 'terms.html'), legalPage(TERMS));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Wrote docs/index.html, docs/privacy-policy.html, docs/terms.html');
