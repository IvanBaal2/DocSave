/**
 * Import pipelines. Every path ends the same way: plaintext bytes in memory or
 * a system temporary copy that is handed straight to native encryption and
 * deleted; nothing is written unencrypted by Docsave.
 *
 * Files are validated before they are accepted: supported type, size limit,
 * and a content check (a file named .pdf must really be a PDF, an image must
 * really be an image) so damaged files are reported instead of saved.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { toByteArray } from 'base64-js';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { sha256File } from '../../modules/docsave-security';
import type { PendingPage } from '../vault/types';
import { deleteTempFile } from './secureTemp';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_IMPORT = 20;

/** User-facing import problem; `message` is an English source string for t(). */
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

/** Types Docsave accepts. Others are refused with an explanation. */
export const SUPPORTED_MIME = new Set(Object.values(EXT_MIME));

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

/**
 * Checks that the first bytes match the declared type. Returns an English
 * problem message, or null when the file looks fine.
 */
export function contentProblem(head: Uint8Array, mime: string): string | null {
  if (head.length === 0) return 'This file is empty or damaged.';
  const sniffed = sniffMime(head, 'unknown');
  if (mime === 'application/pdf' && sniffed !== 'application/pdf') return 'This PDF file is damaged and cannot be opened.';
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime) && !sniffed.startsWith('image/')) {
    return 'This image file is damaged and cannot be opened.';
  }
  // DOCX files are ZIP archives ("PK").
  if (mime.endsWith('wordprocessingml.document') && !(head[0] === 0x50 && head[1] === 0x4b)) {
    return 'This Word document is damaged and cannot be opened.';
  }
  return null;
}

export function fileProblem(name: string | undefined, mime: string, size: number | null | undefined): string | null {
  if (!SUPPORTED_MIME.has(mime) && !mime.startsWith('image/')) {
    return 'This file type is not supported. Use PDF, JPG, PNG, HEIC, Word or text files.';
  }
  if (size === 0) return 'This file is empty or damaged.';
  if (size != null && size > MAX_FILE_BYTES) return 'This file is larger than 25 MB. Please choose a smaller file.';
  void name;
  return null;
}

/** A picked file: either accepted (`page`) or refused with a reason. */
export type PickedFile = { name: string; page?: PendingPage; problem?: string };

function baseName(name: string | undefined, fallback: string): string {
  const n = (name ?? '').replace(/\.[A-Za-z0-9]{1,5}$/, '').trim();
  return n || fallback;
}

async function readHead(uri: string): Promise<Uint8Array> {
  try {
    const handle = new File(uri).open();
    try {
      return handle.readBytes(16);
    } finally {
      handle.close();
    }
  } catch {
    return new Uint8Array();
  }
}

/** Opens the system file picker (device storage, Files app, cloud providers the user installed). */
export async function pickFiles(options: { multiple: boolean; label?: string }): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*', 'text/plain', 'application/msword', EXT_MIME.docx, '*/*'],
    copyToCacheDirectory: true,
    multiple: options.multiple,
  });
  if (res.canceled || !res.assets?.length) return [];
  const out: PickedFile[] = [];
  for (const [i, a] of res.assets.entries()) {
    const name = a.name ?? `File ${i + 1}`;
    if (i >= MAX_FILES_PER_IMPORT) {
      deleteTempFile(a.uri);
      out.push({ name, problem: 'Too many files at once. Import up to 20 files at a time.' });
      continue;
    }
    const mime = guessMime(a.name, a.mimeType);
    const problem = fileProblem(name, mime, a.size) ?? contentProblem(await readHead(a.uri), mime);
    if (problem) {
      deleteTempFile(a.uri);
      out.push({ name, problem });
      continue;
    }
    out.push({
      name,
      page: {
        label: options.label ?? 'File',
        fileUri: a.uri,
        size: a.size ?? undefined,
        mimeType: mime,
        fileName: name,
        sha256: (await sha256File(a.uri)) ?? undefined,
      },
    });
  }
  return out;
}

function hashBase64(b64: string): string {
  return Array.from(sha256(toByteArray(b64)), (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Opens the system photo picker; photos are returned in memory (for reading) and the temp copies deleted. */
export async function pickPhotos(options: { multiple: boolean; label?: string }): Promise<PickedFile[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.92,
    exif: false,
    base64: true,
    allowsMultipleSelection: options.multiple,
    selectionLimit: options.multiple ? MAX_FILES_PER_IMPORT : 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (res.canceled || !res.assets?.length) return [];
  return res.assets.map((a, i) => {
    deleteTempFile(a.uri);
    const name = a.fileName ?? `Photo ${i + 1}`;
    if (!a.base64) return { name, problem: 'The photo could not be read.' };
    const size = Math.floor((a.base64.length * 3) / 4);
    const problem = fileProblem(name, a.mimeType ?? 'image/jpeg', size);
    if (problem) return { name, problem };
    return {
      name,
      page: {
        label: options.label ?? 'Photo',
        base64: a.base64,
        size,
        mimeType: a.mimeType ?? 'image/jpeg',
        fileName: a.fileName ?? undefined,
        sha256: hashBase64(a.base64),
      },
    };
  });
}

/** Name suggestion from a file name ("Scan_2026-03-01.pdf" → "Scan_2026-03-01"). */
export function nameFromFile(name: string | undefined, fallback: string): string {
  return baseName(name, fallback);
}

// ── Single-file helpers used while scanning a specific document type ──────────

export async function importFromFiles(label: string): Promise<PendingPage | null> {
  const [first] = await pickFiles({ multiple: false, label });
  if (!first) return null;
  if (first.problem) throw new ImportError(first.problem);
  return first.page ?? null;
}

export async function importFromPhotos(label: string): Promise<PendingPage | null> {
  const [first] = await pickPhotos({ multiple: false, label });
  if (!first) return null;
  if (first.problem) throw new ImportError(first.problem);
  return first.page ?? null;
}
