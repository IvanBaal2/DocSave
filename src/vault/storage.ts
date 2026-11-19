/**
 * Encrypted on-disk storage.
 *
 *   <app documents>/docsave-vault/          (private app sandbox, excluded from backup)
 *     vault.id                              random vault id (not secret)
 *     index.enc                             encrypted index (names, notes, dates…)
 *     blobs/<pageId>.enc                    encrypted document pages
 *
 * Nothing is ever written in plaintext: data is encrypted in memory first,
 * then written to a temp name and atomically moved into place.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { NativeSecurity, excludeFromBackup, nativeErrorCode } from '../../modules/docsave-security';
import { b64 } from '../crypto/base64';
import {
  FormatError,
  TamperError,
  decryptJson,
  decryptObject,
  deriveObjectKey,
  encryptJson,
  encryptObject,
  randomBytes,
  wipe,
} from '../crypto/core';
import { deleteTempFile } from '../security/secureTemp';
import type { PendingPage, VaultIndex } from './types';

const INDEX_ID = '__index__';

const vaultDir = () => new Directory(Paths.document, 'docsave-vault');
const blobsDir = () => new Directory(vaultDir(), 'blobs');
const idFile = () => new File(vaultDir(), 'vault.id');
const indexFile = () => new File(vaultDir(), 'index.enc');
const blobFile = (id: string) => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid object id');
  return new File(blobsDir(), `${id}.enc`);
};

export function newId(): string {
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const emptyIndex = (): VaultIndex => ({ version: 1, documents: [], customCategories: [] });

/** Atomic write: temp file + move, so a crash never leaves a half-written object. */
function writeAtomic(target: File, data: Uint8Array): void {
  const tmp = new File(target.parentDirectory, `${target.name}.tmp`);
  if (tmp.exists) tmp.delete();
  tmp.create();
  tmp.write(data);
  tmp.move(target, { overwrite: true });
}

/**
 * Creates the vault directory. An existing directory is only replaced when the
 * caller confirms its keys are gone (orphaned ciphertext that can never be
 * decrypted again); otherwise this refuses, so a vault is never overwritten.
 */
export function createVaultStorage(vaultId: string, opts: { replaceOrphan: boolean }): void {
  const dir = vaultDir();
  if (dir.exists) {
    if (!opts.replaceOrphan) throw new Error('Vault storage already exists and was left untouched.');
    dir.delete();
  }
  dir.create({ intermediates: true });
  blobsDir().create({ intermediates: true });
  excludeFromBackup(dir.uri);
  const f = idFile();
  f.create();
  f.write(vaultId);
}

export function readVaultId(): string | null {
  const f = idFile();
  if (!f.exists) return null;
  try {
    return f.textSync().trim();
  } catch {
    return null;
  }
}

/** Re-applies backup exclusion on every launch (cheap, idempotent). */
export function reassertBackupExclusion(): void {
  const dir = vaultDir();
  if (dir.exists) excludeFromBackup(dir.uri);
}

export async function readIndex(masterKey: Uint8Array): Promise<VaultIndex> {
  const f = indexFile();
  if (!f.exists) return emptyIndex();
  const data = await f.bytes();
  const index = decryptJson<VaultIndex>(masterKey, INDEX_ID, data);
  if (index?.version !== 1 || !Array.isArray(index.documents)) throw new Error('Corrupt vault index');
  index.customCategories ??= [];
  return index;
}

export function writeIndex(masterKey: Uint8Array, index: VaultIndex): void {
  writeAtomic(indexFile(), encryptJson(masterKey, INDEX_ID, index));
}

const aadFor = (id: string) => `docsave/aad/v1/${id}`;

function mapNativeError(e: unknown): never {
  const code = nativeErrorCode(e);
  if (code === 'ERR_TAMPER') throw new TamperError();
  if (code === 'ERR_FORMAT') throw new FormatError();
  if (code === 'ERR_MISSING') throw new Error('Encrypted page is missing from the vault.');
  throw e;
}

/**
 * Encrypts one page and writes it to blobs/<id>.enc. With the native module the
 * plaintext never passes through JavaScript byte arrays: AES-256-GCM runs in the
 * platform crypto library. Temporary picker files are deleted afterwards.
 * Returns the plaintext size and the first bytes (for file-type sniffing).
 */
export async function writeBlob(
  masterKey: Uint8Array,
  id: string,
  page: Pick<PendingPage, 'base64' | 'fileUri'>,
): Promise<{ size: number; head: Uint8Array }> {
  const target = blobFile(id);
  const key = deriveObjectKey(masterKey, id);
  try {
    if (NativeSecurity) {
      const keyB64 = b64.encode(key);
      if (page.base64 != null) {
        await NativeSecurity.sealToFile(keyB64, aadFor(id), page.base64, target.uri);
        const head = b64.decode(page.base64.slice(0, 24));
        return { size: Math.floor((page.base64.length * 3) / 4), head };
      }
      if (page.fileUri) {
        const r = await NativeSecurity.sealFileToFile(keyB64, aadFor(id), page.fileUri, target.uri);
        return { size: r.size, head: b64.decode(r.head) };
      }
      throw new Error('Nothing to encrypt.');
    }
    // JavaScript fallback (tests, Expo Go): identical file format.
    const bytes = page.base64 != null ? b64.decode(page.base64) : await new File(page.fileUri!).bytes();
    try {
      writeAtomic(target, encryptObject(masterKey, id, bytes));
      return { size: bytes.length, head: bytes.slice(0, 16) };
    } finally {
      wipe(bytes);
    }
  } finally {
    wipe(key);
    if (page.fileUri) deleteTempFile(page.fileUri);
  }
}

/** Decrypts one page and returns it as base64 (for the in-memory viewer). */
export async function readBlob(masterKey: Uint8Array, id: string): Promise<string> {
  const f = blobFile(id);
  if (!f.exists) throw new Error('Encrypted page is missing from the vault.');
  if (NativeSecurity) {
    const key = deriveObjectKey(masterKey, id);
    try {
      return await NativeSecurity.openFile(b64.encode(key), aadFor(id), f.uri);
    } catch (e) {
      mapNativeError(e);
    } finally {
      wipe(key);
    }
  }
  const plain = decryptObject(masterKey, id, await f.bytes());
  try {
    return b64.encode(plain);
  } finally {
    wipe(plain);
  }
}

export function deleteBlob(id: string): void {
  const f = blobFile(id);
  if (f.exists) f.delete();
}

/** Removes blobs that are not referenced by the index (e.g. after a crash). */
export function sweepOrphans(index: VaultIndex): number {
  const dir = blobsDir();
  if (!dir.exists) return 0;
  const live = new Set(index.documents.flatMap((d) => d.pages.map((p) => `${p.id}.enc`)));
  let removed = 0;
  for (const entry of dir.list()) {
    if (entry instanceof File && !live.has(entry.name)) {
      entry.delete();
      removed++;
    }
  }
  return removed;
}

export function deleteAllBlobs(): void {
  const dir = blobsDir();
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true });
}

export function destroyVaultStorage(): void {
  const dir = vaultDir();
  if (dir.exists) dir.delete();
}

export function vaultStorageExists(): boolean {
  return vaultDir().exists;
}
