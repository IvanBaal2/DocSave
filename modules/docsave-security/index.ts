import { requireOptionalNativeModule } from 'expo';

export type IntegrityReport = {
  /** True when strong indicators of root / jailbreak / instrumentation were found. */
  compromised: boolean;
  /** Running on an emulator or simulator (informational, not treated as compromise). */
  emulator: boolean;
  /** Human-readable indicator identifiers, e.g. "path:/system/bin/su". */
  reasons: string[];
};

export type OcrLine = { text: string; x: number; y: number; w: number; h: number };
export type OcrResult = { width: number; height: number; lines: OcrLine[] };

type NativeModuleShape = {
  excludeFromBackup(path: string): boolean;
  checkIntegrity(): IntegrityReport;
  pbkdf2Sha256(password: string, saltB64: string, iterations: number, length: number): Promise<string>;
  sealToFile(keyB64: string, aad: string, dataB64: string, path: string): Promise<number>;
  sealFileToFile(keyB64: string, aad: string, inPath: string, outPath: string): Promise<{ size: number; head: string }>;
  openFile(keyB64: string, aad: string, path: string): Promise<string>;
  recognizeText(imageB64: string): Promise<OcrResult>;
  cropJpeg(imageB64: string, x: number, y: number, w: number, h: number, quality: number): Promise<string>;
};

const Native = requireOptionalNativeModule<NativeModuleShape>('DocsaveSecurity');

/** Whether the native module is linked (false in Expo Go / unit tests). */
export const isNativeSecurityAvailable = Native != null;

/** The raw native module (null when not linked). Used by the crypto / storage layers. */
export const NativeSecurity = Native;

/**
 * iOS: sets NSURLIsExcludedFromBackupKey so the vault directory is never copied
 * to iCloud or Finder backups. Android: no-op (backups disabled app-wide).
 */
export function excludeFromBackup(fileUri: string): boolean {
  if (!Native) return false;
  try {
    return Native.excludeFromBackup(fileUri);
  } catch {
    return false;
  }
}

export function checkIntegrity(): IntegrityReport {
  if (!Native) return { compromised: false, emulator: false, reasons: ['native-check-unavailable'] };
  try {
    return Native.checkIntegrity();
  } catch {
    return { compromised: false, emulator: false, reasons: ['native-check-failed'] };
  }
}

/** On-device OCR (ML Kit bundled model on Android, Apple Vision on iOS). */
export async function recognizeText(imageB64: string): Promise<OcrResult> {
  if (!Native) throw new Error('On-device text recognition is not available in this build.');
  return Native.recognizeText(imageB64);
}

/** Crops a JPEG (normalised 0..1 rectangle) in memory. Returns base64 JPEG. */
export async function cropJpeg(imageB64: string, rect: { x: number; y: number; w: number; h: number }, quality = 0.9) {
  if (!Native) return imageB64;
  return Native.cropJpeg(imageB64, rect.x, rect.y, rect.w, rect.h, quality);
}

/** Native error codes thrown by sealing / opening functions. */
export function nativeErrorCode(e: unknown): string | undefined {
  const err = e as { code?: string; message?: string };
  if (err?.code && err.code.startsWith('ERR_')) return err.code;
  const m = /ERR_[A-Z]+/.exec(err?.message ?? '');
  return m?.[0];
}
