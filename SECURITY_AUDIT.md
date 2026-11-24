# Docsave security audit — version 1.1.0

Date: 19 November 2026 · Scope: source code, build configuration, generated Android manifest, dependencies, and the released Android APK signature.
This is an internal engineering audit, not a certification. An independent penetration test is still recommended before a public launch.

## 1. Findings and fixes in this release

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | **Vault creation failed** on devices whose biometric status is "unknown" (seen on a Huawei phone): `expo-secure-store` refused to create a biometric-bound Keystore key, and setup aborted. | Critical (app unusable) | **Fixed.** The PIN-protected key is created first; biometric binding is attempted afterwards, falling back to an OS biometric check. Setup is transactional, verifies the encrypted index, never overwrites an existing vault, and ends with a "vault ready" confirmation. Covered by unit tests that simulate this device behaviour. |
| F2 | **Slow unlock ("Verifying…" for ~10 s).** scrypt ran in interpreted JavaScript on Hermes (measured 9.6–12.6 s per derivation in interpreter mode). | High (usability) | **Fixed.** PIN keys now use PBKDF2-HMAC-SHA256, 600,000 iterations (OWASP 2023 guidance), computed by native platform crypto. Old scrypt keys still unlock once and are re-wrapped automatically. |
| F3 | Document encryption ran in JavaScript (slow for large files, plaintext copies in JS memory). | Medium | **Fixed.** AES-256-GCM sealing/opening of pages now runs in Android's Conscrypt/BoringSSL and Apple CryptoKit. The file format is unchanged (compatible). |
| F4 | **Placeholder launch screen.** The Expo default splash (white grid) appeared at launch because SDK 58 ignores the legacy `splash` key. | Low (appearance) | **Fixed** with the `expo-splash-screen` plugin and the Docsave artwork. |
| F5 | Release builds included the Expo development launcher module configuration. | Low | **Fixed.** `expo-dev-client` is only configured for development builds. |
| F6 | Root detection executed a shell command (`which su`). Running shell commands is a pattern that security scanners flag. | Low | **Fixed.** Only file and system-property checks remain. |
| F7 | **Anonymous signing certificate.** The keystore Expo generated in the cloud has an empty subject (`CN=, O=, C=`). It is cryptographically valid, but some device scanners treat apps from unidentified signers as "unknown". | Medium (trust) | **Fixed (24 Nov 2026).** New upload key `CN=Ivan Baal, O=Docsave` (RSA-4096, SHA-256 fingerprint C2:1E:1B:53:…:FF:12), used for APK and AAB builds via `credentials.json` (kept out of git). |
| F8 | npm audit: 3 moderate findings, all one advisory: `minimatch` ReDoS (GHSA-g3hv-75wg-m249) via `@expo/fingerprint`. | Low | **Accepted.** Build-time tool only; not included in the app bundle. Will be resolved by a future Expo update. |

## 2. The Huawei "Threat detected" warning

**What it is.** Huawei's "Pure Mode" / app security check shows this for apps installed from outside AppGallery ("Installed from: Browser"). It reflects Huawei's policy for unverified sources and unknown developers. It does not report a specific vulnerability.

**What was checked:**
- Signature: valid APK Signature Scheme v2, RSA-2048, not a debug key (see §4).
- Manifest: no dangerous or unusual permissions, no `INTERNET`, no overlays, no SMS/contacts/location/storage, `allowBackup=false`, not debuggable (§3).
- No ads, analytics, trackers, dynamic code loading, or remote code (`eval` disabled in the PDF viewer, WebView has no network access).

None of those checks found a defect that explains a "threat". Most likely the warning comes from the install source plus the anonymous developer certificate (F7).

**What will remove it.** Nothing inside the app can "turn off" this warning, and it must not be bypassed. The legitimate routes are:
1. **Publish on Huawei AppGallery.** Apps installed from AppGallery pass Huawei's own review and do not show this warning. Docsave works without Google services: the OCR model is bundled and nothing needs Google Play Services.
2. **Publish on Google Play** for other Android phones (Play Protect then knows the developer).
3. For sideloaded test builds, sign with a certificate that names the developer (F7). This can make some scanners less suspicious, but it is no guarantee.

Docsave has **not** been submitted to or approved by Huawei. No such claim is made.

**Recommendation for F7.** Before the first store upload, create an upload keystore with a real distinguished name, for example `CN=Ivan Baal, O=Docsave, C=PH`, and register it in EAS with `eas credentials`. On Google Play and AppGallery the stores re-sign the app with their own app-signing keys, so the upload key's name is mainly relevant for sideloaded APKs.

## 3. Android permissions (production build)

Generated from the production manifest (`DOCSAVE_PROFILE=production npx expo prebuild`):

| Permission | Why | Notes |
|---|---|---|
| `CAMERA` | Scanning documents and reading boarding-pass barcodes | Requested only when you open the scanner |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | Fingerprint / face unlock | Normal permission, no prompt |
| `POST_NOTIFICATIONS` | Optional expiry reminders (Android 13+) | Requested only if you turn reminders on |
| `VIBRATE` | Haptic feedback | Normal permission |

Explicitly **removed**, including any that libraries try to add: `INTERNET`, `ACCESS_NETWORK_STATE`, `RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`, `ACCESS_FINE/COARSE_LOCATION`, `SYSTEM_ALERT_WINDOW`, `com.google.android.gms.permission.AD_ID`.

Without `INTERNET`, the operating system blocks every network connection from Docsave, including from bundled libraries (ML Kit cannot send usage logs).

iOS: Camera, Face ID and Photo Library usage descriptions only. There is no push entitlement (`aps-environment` removed). The privacy manifest declares no tracking and no collected data.

## 4. APK signature verification

Verified with `node scripts/verify-apk.mjs <apk>`, which parses the APK Signing Block. Android verifies the signature itself at install time.

Previous test build (1.0.0, EAS build `b348da24…`):
```
v1 (JAR): absent   v2: present   v3: absent
Certificate: RSA 2048, self-signed, valid until 2054, NOT a debug key
Subject: (empty)  ← finding F7
SHA-256 fingerprint: 1B:F7:6C:CD:0D:3B:0E:70:F3:A2:0F:87:52:9D:FA:A7:9C:6D:A3:55:F9:C2:D6:A1:40:A7:67:68:DE:C3:0F:A0
```
v1 signing is not required because `minSdkVersion` is 26 (Android 8.0). Build 1.1.0 uses the same EAS keystore; its results are in §8.

## 5. Encryption implementation review

| Item | Implementation | Assessment |
|---|---|---|
| Master key | 256-bit from the platform CSPRNG (`SecRandomCopyBytes` / `SecureRandom`); all-zero output rejected | OK |
| Key storage | Keychain / Android Keystore, `…ThisDeviceOnly`, never synced or backed up | OK |
| PIN | PBKDF2-HMAC-SHA256, 600k iterations, 128-bit salt; the PIN is never used directly as a key; KEK wraps the master key with AES-256-GCM | OK |
| Brute force | 5 free attempts, then 30 s doubling to 1 h; optional erase after 10 | OK |
| Biometrics | Hardware-bound key where the OS supports it; otherwise an OS biometric check releases a Keystore-encrypted key (shown to the user as "device check"); two-factor mode requires the hardware binding | OK, documented trade-off |
| Documents | AES-256-GCM, random 96-bit nonce per write, per-object key HKDF-SHA256(master, object id), AAD binds blob ↔ id | OK — tamper and swap detection tested |
| Index (names, recognised details) | Same scheme, atomic writes | OK |
| Temp files | Camera/picker files deleted immediately; leftovers purged at launch and unlock; no thumbnails | OK |
| Viewer | In-memory, WebView incognito, CSP `default-src 'none'`, no file access, no navigation | OK |
| OCR | On-device only (ML Kit bundled model / Apple Vision); results stored only in the encrypted index | OK |

## 6. Test evidence

`npm test`: **73 tests passing**:
- crypto: round trip, tamper detection on every region, blob swapping, wrong key, PBKDF2 wrap/unwrap, downgrade refusal, legacy upgrade path
- key manager: all unlock modes, Huawei-style biometric refusal with fallback, PIN change, mode switching, key loss, no overwrite of an existing vault, lockout
- extraction: ICAO specimen passport (TD3) and ID (TD1) with check digits, OCR noise tolerance, rejection of corrupted zones, EU licence fields, IATA boarding-pass barcode, ticket text, "never invent" behaviour
- auto-capture decisions, notification privacy, viewer CSP and HTML escaping

Not yet verified on devices: the native OCR/crypto code compiles in the EAS build (§8); behaviour on the Huawei test phone and on an iPhone must be confirmed with the manual checklist in `TESTING.md`.

## 7. Remaining recommendations

1. Replace the anonymous upload certificate before the first store submission (F7).
2. Distribute through AppGallery and Google Play, not APK links.
3. Commission an external mobile penetration test.
4. Re-run `npm audit` after each Expo update.

## 8. Build 1.1.0 results

Android test APK, EAS build `1a49d28e-89cf-46f1-8dd5-55440e35b56a` (profile `preview`, release configuration):

```
File SHA-256: be551e3760a395023b99b9339cbe4ba41f739d46572a71939cee117092a22b1e  (145.7 MB, universal: arm64-v8a, armeabi-v7a, x86, x86_64)
v1 (JAR): absent   v2: present   v3: absent
Certificate: RSA 2048, self-signed, valid until 2054, not a debug key, subject empty (F7)
SHA-256 fingerprint: 1B:F7:6C:CD:0D:3B:0E:70:F3:A2:0F:87:52:9D:FA:A7:9C:6D:A3:55:F9:C2:D6:A1:40:A7:67:68:DE:C3:0F:A0
```

Contents inspected by unpacking the APK:
- Docsave native module compiled in (`pbkdf2Sha256`, `sealToFile`, `openFile`, `recognizeText`, `cropJpeg`). Class names are obfuscated by R8 in release.
- ML Kit bundled OCR pipeline (`libmlkit_google_ocr_pipeline.so`) and models (`assets/mlkit-google-ocr-models/…`) present, so OCR works offline and without Google Play Services.
- Manifest: `INTERNET` and `AD_ID` absent; `CAMERA` present.
- No `which su` shell execution; no development-launcher activity.

The universal APK is large because it contains every CPU architecture and the OCR models. The Play Store AAB delivers only the parts each phone needs.

Android App Bundle for Google Play / AppGallery, EAS build `a518028f-5cda-4ceb-8f67-8ba5fd1c2320` (profile `production`, versionCode 2, version 1.1.0): built successfully. Signed with the same upload key. The stores re-sign it with their own app-signing key.
