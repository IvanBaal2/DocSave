/**
 * Inspects an APK's signatures without the Android SDK.
 *
 *   node scripts/verify-apk.mjs path/to/app.apk
 *
 * Reports which signature schemes are present (v1 JAR, v2, v3 APK Signature
 * Scheme) and the signing certificate (subject, validity, SHA-256 fingerprint).
 * It parses the signing block; full cryptographic verification is done by
 * Android at install time (or `apksigner verify --verbose` if you have the SDK).
 */
import { X509Certificate, createHash } from 'node:crypto';
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/verify-apk.mjs <apk>');
  process.exit(1);
}
const buf = fs.readFileSync(file);

// End of central directory
let eocd = -1;
for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
  if (buf.readUInt32LE(i) === 0x06054b50) {
    eocd = i;
    break;
  }
}
if (eocd < 0) throw new Error('Not a ZIP/APK file');
const cdOffset = buf.readUInt32LE(eocd + 16);
const cdSize = buf.readUInt32LE(eocd + 12);

// v1 (JAR) signature files in the central directory
const names = [];
for (let p = cdOffset; p < cdOffset + cdSize; ) {
  if (buf.readUInt32LE(p) !== 0x02014b50) break;
  const nameLen = buf.readUInt16LE(p + 28);
  const extraLen = buf.readUInt16LE(p + 30);
  const commentLen = buf.readUInt16LE(p + 32);
  names.push(buf.toString('utf8', p + 46, p + 46 + nameLen));
  p += 46 + nameLen + extraLen + commentLen;
}
const v1 = names.filter((n) => /^META-INF\/.*\.(RSA|DSA|EC)$/i.test(n));

// APK Signing Block (immediately before the central directory)
const magic = buf.toString('latin1', cdOffset - 16, cdOffset);
const schemes = { 0x7109871a: 'v2', 0xf05368c0: 'v3', 0x1b93ad61: 'v3.1' };
const found = {};
if (magic === 'APK Sig Block 42') {
  const sizeInFooter = Number(buf.readBigUInt64LE(cdOffset - 24));
  const start = cdOffset - sizeInFooter - 8;
  let p = start + 8;
  const end = cdOffset - 24;
  while (p < end) {
    const len = Number(buf.readBigUInt64LE(p));
    const id = buf.readUInt32LE(p + 8);
    if (schemes[id]) found[schemes[id]] = buf.subarray(p + 12, p + 8 + len);
    p += 8 + len;
  }
}

function firstCertificate(block) {
  // signers: u32 len | signer: u32 len | signed data: u32 len | digests (u32 len ...) | certificates (u32 len | cert: u32 len | DER)
  let p = 0;
  p += 4; // signers sequence length
  p += 4; // first signer length
  p += 4; // signed data length
  const digestsLen = block.readUInt32LE(p);
  p += 4 + digestsLen;
  p += 4; // certificates sequence length
  const certLen = block.readUInt32LE(p);
  return block.subarray(p + 4, p + 4 + certLen);
}

console.log(`File:        ${file} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
console.log(`SHA-256:     ${createHash('sha256').update(buf).digest('hex')}`);
console.log(`v1 (JAR):    ${v1.length ? 'present (' + v1.join(', ') + ')' : 'absent'}`);
console.log(`v2:          ${found.v2 ? 'present' : 'absent'}`);
console.log(`v3:          ${found.v3 ? 'present' : 'absent'}${found['v3.1'] ? ' (+ v3.1)' : ''}`);
const block = found.v3 ?? found.v2;
if (block) {
  const cert = new X509Certificate(firstCertificate(block));
  console.log('Certificate:');
  console.log(`  Subject:   ${cert.subject.replace(/\n/g, ', ')}`);
  console.log(`  Issuer:    ${cert.issuer.replace(/\n/g, ', ')}`);
  console.log(`  Valid:     ${cert.validFrom}  →  ${cert.validTo}`);
  console.log(`  Key:       ${cert.publicKey.asymmetricKeyType} ${cert.publicKey.asymmetricKeyDetails?.modulusLength ?? ''}`);
  console.log(`  SHA-256:   ${cert.fingerprint256}`);
  console.log(`  Self-signed: ${cert.subject === cert.issuer ? 'yes (normal for Android app signing)' : 'no'}`);
} else {
  console.log('No v2/v3 signature block found.');
}
const debugCert = block && new X509Certificate(firstCertificate(block)).subject.includes('Android Debug');
console.log(`Debug key:   ${debugCert ? 'YES — not suitable for release' : 'no'}`);
