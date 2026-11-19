# Security architecture, data flow, retention and threat model

## 1. Data flow

```
Camera / system photo picker / document picker
        │ (temporary file in app cache)
        ▼
On-device OCR (ML Kit bundled / Apple Vision) ──► field extraction (src/scan/extract.ts)
        │                                              │
        ▼                                              ▼
 Native AES-256-GCM seal (Conscrypt / CryptoKit)   encrypted index (same key hierarchy)
        │                                              │
        ▼                                              ▼
 App-private storage (excluded from backup, NSFileProtectionComplete on iOS)
        │
        ├──► In-app viewer (decrypted in memory; FLAG_SECURE / privacy shield)
        └──► User-initiated Export → temp file → system share sheet → leaves Docsave
```
No network path exists: Android release builds have no INTERNET permission, and iOS has no networking code or SDK.

## 2. Key hierarchy
- **Vault key**: 256-bit random, generated on the device.
- **PIN wrap**: PBKDF2-HMAC-SHA256 with 600,000 iterations and a random salt, then AES-256-GCM. Stored in SecureStore (Keystore/Keychain-backed).
- **Biometric wrap**: hardware-bound Keystore/Keychain item, or a device-check fallback (OS prompt plus a Keystore-encrypted item).
- **Per-object keys**: HKDF-SHA256(vault key, object id). AAD is `docsave/aad/v1/<id>`. File format DSV1: magic, nonce, ciphertext and tag.
- **Self-check**: `assertPinOpens` runs after every PIN-key write.

## 3. Retention and deletion

| Data | Kept until | Deletion |
|---|---|---|
| Vault documents and index | User deletes, destroys the vault, or uninstalls | Encrypted files are deleted. Destroy also erases the keys (crypto-shredding). |
| Temporary scan, import and export files | Encryption completes / 60 s after export | Deleted immediately. All `docsave-tmp*` folders are purged at every launch and unlock. |
| Failed-attempt counter | Successful unlock or destroy | Reset |
| Acceptance record (versions, date) | Vault destroyed | Deleted with the settings |
| Local crash record | Shown once at the next start | Cleared after it is shown |
| Support email (publisher) | **Owner to define** | Owner's mailbox procedure |

## 4. Threat model (STRIDE summary)

| Threat | Mitigation | Residual risk |
|---|---|---|
| Lost or stolen locked phone | Encryption at rest, PIN with attempt limits, optional auto-erase, Keystore/Keychain | Weak PIN plus a strong attacker. Mitigated by the PBKDF2 cost and the attempt counter. |
| Shoulder surfing / screenshots | FLAG_SECURE, app-switcher shield, auto-lock | Photo of the screen taken with another camera |
| Malware on a non-rooted device | App sandbox, no exported components with data, no clipboard of documents | OS zero-days |
| Rooted / jailbroken device | Integrity check blocks unlock | Detection can be bypassed (documented to users) |
| Backup / cloud leakage | `allowBackup=false`, data-extraction rules, iOS exclude-from-backup | None known |
| Network exfiltration | No INTERNET permission (Android release); no network SDKs | iOS cannot remove networking capability entirely; no code uses it |
| Supply chain | Lockfile, SBOM, minimal dependencies, no remote code, pdf.js bundled locally with a strict CSP | Compromised upstream package before release |
| Tampered APK (sideload) | Signature scheme v2 | Users installing from unofficial sources |
| Data loss (availability) | Clear no-recovery warning and required acknowledgement, export feature | By design: no recovery |
| Export copy leakage | Explicit confirmation and authentication before export; temp copy deleted | Copy outside Docsave after sharing |
