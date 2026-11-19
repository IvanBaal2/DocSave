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
import { excludeFromBackup } from '../../modules/docsave-security';
import { decryptJson, decryptObject, encryptJson, encryptObject, randomBytes } from '../crypto/core';
import type { VaultIndex } from './types';

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

export function createVaultStorage(vaultId: string): void {
  const dir = vaultDir();
  if (dir.exists) dir.delete();
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

export function writeBlob(masterKey: Uint8Array, id: string, plaintext: Uint8Array): void {
  writeAtomic(blobFile(id), encryptObject(masterKey, id, plaintext));
}

export async function readBlob(masterKey: Uint8Array, id: string): Promise<Uint8Array> {
  const f = blobFile(id);
  if (!f.exists) throw new Error('Encrypted page is missing from the vault.');
  return decryptObject(masterKey, id, await f.bytes());
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
