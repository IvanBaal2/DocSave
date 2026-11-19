/**
 * Secure temporary-file handling.
 *
 * The system camera, photo picker and document picker hand files to Docsave
 * through the app's cache directory. Docsave reads those bytes into memory,
 * encrypts them, and then deletes the plaintext copy immediately. Any leftovers
 * (e.g. after a crash mid-import) are purged at every launch and every unlock.
 *
 * Note: flash storage cannot be reliably overwritten in place, so deletion is
 * not a forensic "secure erase". iOS and Android encrypt the whole data
 * partition with per-file keys, which makes deleted cache data unrecoverable in
 * practice once the file key is discarded.
 */
import { File, Paths } from 'expo-file-system';

const TEMP_DIR_PATTERN = /^(DocumentPicker|ImagePicker|Camera|ImageManipulator|docsave-tmp)/i;

export function deleteTempFile(uri: string | null | undefined): void {
  if (!uri || !uri.startsWith('file://')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

/** Reads a picked / captured file into memory and deletes the plaintext copy. */
export async function consumeTempFile(uri: string): Promise<Uint8Array> {
  try {
    return await new File(uri).bytes();
  } finally {
    deleteTempFile(uri);
  }
}

export function purgeTempFiles(): number {
  let removed = 0;
  try {
    const cache = Paths.cache;
    if (!cache.exists) return 0;
    for (const entry of cache.list()) {
      if (TEMP_DIR_PATTERN.test(entry.name)) {
        try {
          entry.delete();
          removed++;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // Cache directory may be unavailable; nothing to purge.
  }
  return removed;
}
