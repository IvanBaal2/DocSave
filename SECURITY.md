# Docsave security design

## Threat model

**Protects against:**
- Someone who picks up an unlocked phone after Docsave has locked.
- Someone with the phone who does not know the PIN, or who cannot pass biometrics in two-factor mode.
- Extraction of app files through backups, iCloud / Google Drive, adb backup, device-to-device migration, or a computer backup.
- Offline tampering with or swapping of vault files.
- Leakage through the app switcher, screenshots, screen recording, notifications, thumbnails, keyboard learning or temporary files.
- Malicious PDFs trying to send data out (the viewer has no network access).

**Does not protect against, and no app can:**
- A rooted, jailbroken or malware-infected device. Docsave detects common indicators and can refuse to unlock, but detection is heuristic and can be bypassed.
- Someone who knows the PIN, or who can make the owner authenticate.
- Memory inspection while a document is open on a compromised device. JavaScript cannot guarantee that every copy of a key or plaintext is zeroed.

## Key hierarchy

```
                 Platform CSPRNG
                       │
             Master key K (256-bit random, generated on device)
          ┌────────────┼──────────────────────────────┐
          │            │                              │
  scrypt(PIN) → KEK    │ biometric-gated              │ HKDF-SHA256(K, "docsave/blob/<id>")
  AES-GCM wrap(K)      │ Keychain / Keystore item     │ → per-object key
          │            │ (raw K, "PIN or biometric")  │
  Keychain / Keystore  │                              ▼
  (this device only)   │                AES-256-GCM(object, nonce=96-bit random,
                       │                            AAD="docsave/aad/v1/<id>")
```

| Unlock mode | Keychain / Keystore items |
|---|---|
| PIN only | `ds.key.pin` = scrypt-wrapped K (no biometric gate) |
| Biometrics or PIN | `ds.key.pin` + `ds.key.bio` = K, released only by the OS after Face ID / fingerprint |
| Two-factor | `ds.key.pinbio` = scrypt-wrapped K **behind** a biometric gate; nothing else. Both factors are needed. |

- Every item uses `…_THIS_DEVICE_ONLY` accessibility, so it is never synced to iCloud Keychain or restored on another device.
- Biometric items are invalidated by the OS when enrolled biometrics change. In two-factor mode that makes the vault permanently inaccessible, and users are warned before enabling it.
- scrypt parameters are N=2¹⁵, r=8, p=1 (32 MiB). They are stored with the wrapped key so they can be raised later. Lower parameters are rejected (no downgrade).
- No key is hardcoded. The only constants are domain-separation labels.

## On-disk format

```
<app documents>/docsave-vault/          excluded from backup (iOS), backups disabled (Android)
  vault.id                              random id, binds the Keychain items to this vault
  index.enc                             encrypted JSON: names, notes, dates, categories, page list
  blobs/<pageId>.enc                    encrypted document pages
```

Each `.enc` file is `"DSV1" ‖ nonce(12) ‖ ciphertext ‖ tag(16)`. Writes go to a temp file first and are then atomically moved into place. On every unlock, blobs that no longer appear in the index are swept. iOS adds `NSFileProtectionComplete` for all app files, so they cannot be read while the device is locked.

**Reinstall detection:** iOS keeps Keychain items after uninstalling an app. On launch, Docsave compares `vault.id` with the id stored in the Keychain. If they don't match, the orphaned keys are destroyed and setup starts fresh.

## Runtime protections

| Protection | Implementation |
|---|---|
| Auto-lock | Background for ≥ the configured time (immediately, 30 s, 1 min or 5 min), or 5 min idle in the foreground. Locking zeroes the key buffer and unmounts every decrypted screen through route guards. |
| System pickers | Auto-lock is paused only while a system picker, camera permission dialog or biometric prompt is open, and never for more than 10 minutes. |
| Brute force | 5 free attempts, then 30 s, doubling up to 1 hour. The counter is stored in the Keychain / Keystore. Optional erase after 10 failures. scrypt adds about 0.5–2 s per guess on a phone. |
| Re-authentication | Biometrics or PIN before decrypting any document (60 s grace period). PIN only for destructive actions. 5 wrong PINs in the confirmation modal lock the vault. |
| Viewer | Decrypts into memory and renders in a WebView with incognito mode, no cache, no file access, no DOM storage, no navigation, and a CSP of `default-src 'none'` with no `http(s)` sources. pdf.js is embedded in the app, never downloaded, and runs with `isEvalSupported: false`. Decrypted bytes are zeroed when the page changes or the screen loses focus. |
| Screen privacy | Android `FLAG_SECURE` (blocks screenshots and recording, blanks Recents). iOS app-switcher blur and capture protection. An opaque overlay whenever the app is not active. |
| Temp files | Camera, photo picker and document picker files are read into memory and deleted immediately. Leftovers are purged at launch and at every unlock. No thumbnails are ever generated. |
| Input privacy | The PIN uses an in-app keypad, never the system keyboard. Text fields turn off autocorrect, autofill and spellcheck. |
| Notifications | Local only, with generic text by default. Android lock-screen visibility is set to private. The `aps-environment` entitlement is removed. |
| Network | No network code at all. Android release builds remove `INTERNET` and `ACCESS_NETWORK_STATE`. |
| Backups | Android `allowBackup=false`, `fullBackupContent=false`, and `dataExtractionRules` excluding every domain for cloud backup and device transfer. iOS sets `isExcludedFromBackup` on the vault directory, and keys are `ThisDeviceOnly`. |
| Integrity | Native checks for su / Magisk / KernelSU paths, test-keys, debugger, Frida, Cydia / Sileo / `/var/jb`, sandbox escape, `DYLD_INSERT_LIBRARIES` and injected hooking dylibs. The app warns on every launch, and an optional setting blocks unlocking. |

## Limitations and recommendations

- **JavaScript memory.** Key and plaintext buffers are zeroed when they are no longer needed, but the JS engine and WebView may keep transient copies (for example base64 strings) until garbage collection.
- **Deletion on flash storage** is not a forensic secure erase. Full-disk file-based encryption on iOS and Android makes deleted data unrecoverable in practice once file keys are discarded. Destroying the vault erases the master key (crypto-shredding), which makes all ciphertext permanently unreadable.
- **Performance.** AES-GCM runs in JS (`@noble/ciphers`), at roughly a few MB/s on mid-range phones. The import limit is 25 MB. The on-disk format is standard AES-GCM, so a native implementation such as `react-native-quick-crypto` could be swapped in without migrating data.
- **The device passcode matters.** Biometric items require a device passcode. Users should use a strong device passcode and keep the OS updated.
- Get an **independent security audit** before release.

## Reporting vulnerabilities

Please report security issues privately to Docsave@gmail.com instead of opening a public GitHub issue.
