import { requireOptionalNativeModule } from 'expo';

export type IntegrityReport = {
  /** True when strong indicators of root / jailbreak / instrumentation were found. */
  compromised: boolean;
  /** Running on an emulator or simulator (informational, not treated as compromise). */
  emulator: boolean;
  /** Human-readable indicator identifiers, e.g. "su-binary", "cydia". */
  reasons: string[];
};

type NativeModuleShape = {
  excludeFromBackup(path: string): boolean;
  checkIntegrity(): IntegrityReport;
};

const Native = requireOptionalNativeModule<NativeModuleShape>('DocsaveSecurity');

/** Whether the native module is linked (false in Expo Go / unit tests). */
export const isNativeSecurityAvailable = Native != null;

/**
 * iOS: sets NSURLIsExcludedFromBackupKey so the vault directory is never copied
 * to iCloud or Finder/iTunes backups. Android: no-op (backups are disabled
 * application-wide by the withAndroidNoBackup config plugin).
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
