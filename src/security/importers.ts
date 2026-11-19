/**
 * Import pipelines. Every path ends the same way: plaintext bytes in memory,
 * the system's temporary copy deleted, nothing written unencrypted by Docsave.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { PendingPage } from '../vault/types';
import { deleteTempFile } from './secureTemp';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class ImportError extends Error {}

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export function guessMime(name: string | undefined, fallback?: string | null): string {
  const ext = name?.split('.').pop()?.toLowerCase() ?? '';
  return (fallback && fallback !== 'application/octet-stream' ? fallback : EXT_MIME[ext]) ?? 'application/octet-stream';
}

/** Basic magic-number sniffing so a renamed file is labelled by what it really is. */
export function sniffMime(bytes: Uint8Array, declared: string): string {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return declared;
}

function checkSize(size: number | null | undefined) {
  if (size != null && size > MAX_FILE_BYTES) {
    throw new ImportError('This file is larger than 25 MB. Please choose a smaller file.');
  }
}

/**
 * Picks a file. The system copies it into the app cache; that temporary copy is
 * handed directly to native encryption and deleted right after (see writeBlob).
 */
export async function importFromFiles(label: string): Promise<PendingPage | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  try {
    checkSize(a.size);
  } catch (e) {
    deleteTempFile(a.uri);
    throw e;
  }
  return { label, fileUri: a.uri, size: a.size ?? undefined, mimeType: guessMime(a.name, a.mimeType) };
}

/** Picks a photo, returned as base64 in memory (for OCR); the temp copy is deleted. */
export async function importFromPhotos(label: string): Promise<PendingPage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    exif: false,
    base64: true,
    allowsMultipleSelection: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  deleteTempFile(a.uri);
  if (!a.base64) throw new ImportError('The photo could not be read.');
  const size = Math.floor((a.base64.length * 3) / 4);
  checkSize(size);
  return { label, base64: a.base64, size, mimeType: a.mimeType ?? 'image/jpeg' };
}
