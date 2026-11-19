/**
 * User-initiated export ("give me my document back"): decrypts one page into
 * a temporary file in the app cache and opens the system share sheet. The
 * user decides where it goes (save to Files, print, send). Once shared, that
 * copy is outside Docsave's protection.
 *
 * The temporary copy is deleted shortly after the share sheet closes (a short
 * delay lets the receiving app finish reading it) and, at the latest, at the
 * next launch or unlock (purgeTempFiles removes every "docsave-tmp*" folder).
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'text/plain': 'txt',
};

function safeFileName(name: string, mimeType: string): string {
  const base = name.normalize('NFKD').replace(/[^\w .-]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'document';
  return `${base}.${EXT[mimeType] ?? 'bin'}`;
}

export async function exportPage(base64: string, name: string, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  const dir = new Directory(Paths.cache, 'docsave-tmp-export');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, safeFileName(name, mimeType));
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  try {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Export document' });
  } finally {
    setTimeout(() => {
      try {
        if (file.exists) file.delete();
      } catch {
        // removed at next launch / unlock
      }
    }, 60_000);
  }
}
