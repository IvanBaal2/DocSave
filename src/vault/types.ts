export type UnlockMode =
  /** PIN only. */
  | 'pin'
  /** PIN, or Face ID / fingerprint as a faster alternative. */
  | 'pin_or_bio'
  /** Two factors: Face ID / fingerprint AND PIN are both required. */
  | 'pin_and_bio';

/** How biometric unlock is protected: OS-enforced key (hardware) or OS prompt + Keystore-encrypted key. */
export type BioBinding = 'hardware' | 'device-check';

/** A piece of information recognised (or entered) for a document. Stored encrypted in the index. */
export type DocField = {
  key: string;
  label: string;
  value: string;
  /** recognized: read by on-device OCR / barcode; missing: could not be read; edited/manual: typed by the user. */
  status: 'recognized' | 'missing' | 'edited' | 'manual';
};

export type PageRecord = {
  id: string;
  /** e.g. "Front", "Back", "Page 2". */
  label: string;
  mimeType: string;
  size: number;
};

export type DocumentRecord = {
  id: string;
  name: string;
  categoryId: string;
  /** Sub-type within a built-in category, e.g. "passport". */
  docType?: string;
  notes?: string;
  /** ISO date (YYYY-MM-DD) – expiry date, or travel date for travel documents. */
  expiryDate?: string;
  pages: PageRecord[];
  /** Information recognised from the scan and reviewed by the user. */
  fields?: DocField[];
  /** Automatically generated summary, e.g. "Passport · Anna Maria Eriksson · expires 15 Apr 2032". */
  description?: string;
  createdAt: number;
  updatedAt: number;
};

export type CustomCategory = {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
};

/** The encrypted vault index (stored as one AES-GCM object). */
export type VaultIndex = {
  version: 1;
  documents: DocumentRecord[];
  customCategories: CustomCategory[];
};

/** Non-secret metadata kept in the Keychain/Keystore (no document data). */
export type VaultMeta = {
  version: 1;
  vaultId: string;
  createdAt: number;
  unlockMode: UnlockMode;
  pinLength: number;
  bioBinding?: BioBinding;
};

export type NotificationDetail = 'generic' | 'category';

export type Settings = {
  /** Seconds in background before locking. 0 = immediately. */
  autoLockSeconds: number;
  /** Hide content in the app switcher and block screenshots / recording. */
  hideSensitivePreviews: boolean;
  /** Ask for Face ID / fingerprint / PIN again before showing a document. */
  reauthForDocuments: boolean;
  /** Erase the vault after 10 consecutive wrong PINs. */
  wipeAfterFailedAttempts: boolean;
  /** Refuse to unlock on rooted / jailbroken devices. */
  blockOnCompromisedDevice: boolean;
  notificationsEnabled: boolean;
  expiryReminders: boolean;
  identityReminders: boolean;
  travelReminders: boolean;
  reminderLeadDays: number;
  notificationDetail: NotificationDetail;
  /** Off by default. Docsave has no analytics SDK; this only enables a manual diagnostics report. */
  diagnosticsEnabled: boolean;
  acceptedTermsVersion: string | null;
  acceptedPrivacyVersion: string | null;
};

export const DEFAULT_SETTINGS: Settings = {
  autoLockSeconds: 30,
  hideSensitivePreviews: true,
  reauthForDocuments: true,
  wipeAfterFailedAttempts: false,
  blockOnCompromisedDevice: false,
  notificationsEnabled: false,
  expiryReminders: true,
  identityReminders: true,
  travelReminders: true,
  reminderLeadDays: 30,
  notificationDetail: 'generic',
  diagnosticsEnabled: false,
  acceptedTermsVersion: null,
  acceptedPrivacyVersion: null,
};

/**
 * A page waiting to be encrypted: either base64 data held in memory (camera
 * scans) or a temporary file from a system picker (deleted after sealing).
 */
export type PendingPage = {
  label: string;
  mimeType: string;
  base64?: string;
  fileUri?: string;
  size?: number;
};

export type NewDocumentInput = {
  name: string;
  categoryId: string;
  docType?: string;
  notes?: string;
  expiryDate?: string;
  fields?: DocField[];
  description?: string;
  pages: PendingPage[];
};
