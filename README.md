# Docsave

**Your Documents. Your Device. Your Privacy.**

Docsave is a private, offline document vault for Android and iOS. Passports, ID cards (front and back), tickets, certificates, contracts and receipts are encrypted with **AES-256-GCM on the device** before they are written to storage. There is no account, no cloud, no server, no analytics, and no way to recover the vault.

Built with **Expo SDK 58 / React Native 0.88 (New Architecture)**, TypeScript and expo-router.

---

## Features

| Area | What's implemented |
|---|---|
| **Onboarding** | Welcome → local encrypted storage → no-recovery acknowledgement → Terms (accept) → Privacy Policy (accept) → create PIN (6 or 8 digits, weak-PIN rejection) → biometrics → key generation → dashboard. The vault is not created until every step is done. |
| **Dashboard** | Logo, live security status, device integrity, document / expiring / category counts, search, category grid, recently added, Add Document button, settings, lock-now. |
| **Categories** | Identity (passport, national ID front/back, driving licence, residence permit), Travel (plane/train tickets, boarding passes, hotels, insurance), Personal (birth/marriage certificates, contracts, letters, medical), Other (terms, receipts, PDFs, images, other), plus **custom folders**. |
| **Add document** | Guided camera scanner with card / passport / A4 frames, front/back slots for ID documents, photo library import, file import (PDF, JPG, PNG, GIF, WebP, HEIC, TXT, any file ≤ 25 MB), name, category, type, notes, optional expiry or travel date. |
| **Viewer** | Re-authentication before decrypting, in-memory decryption, offline pdf.js PDF rendering, pinch-zoom, front/back switching, edit (rename, notes, category, date), delete. Locks itself when you leave the screen or background the app. |
| **Security** | AES-256-GCM, per-file HKDF keys, scrypt PIN key-wrapping, Keychain/Keystore storage, biometric or two-factor (biometric + PIN) unlock, auto-lock, inactivity lock, brute-force lockout, optional auto-erase, root/jailbreak detection, screenshot / app-switcher protection, backup exclusion, temp-file purging. |
| **Privacy** | No account, no network (Android release builds have no INTERNET permission), no trackers, private notification text, opt-in manual diagnostics report. |
| **Notifications** | Optional local reminders: passport/ID (6 months, chosen lead time, 7 days, on the day), travel (7 days, 1 day), other expiries. Never include names, numbers or contents. No push server; remote-push entitlement removed. |
| **Settings** | Security settings, change PIN, Face ID / fingerprint, automatic lock, privacy settings, notifications, folders, Terms, Privacy Policy, About, delete all documents, permanently destroy vault. |

See [SECURITY.md](SECURITY.md) for the full security design and [TESTING.md](TESTING.md) for the test plan.

---

## Project structure

```
app/                          expo-router screens
  _layout.tsx                 providers + route guards (vault / lock / onboarding)
  lock.tsx                    PIN, biometric and two-factor unlock, lockout, "forgot PIN"
  onboarding/                 8-step first-time setup
  (vault)/                    only mounted while the vault is unlocked
    index.tsx                 dashboard
    add.tsx                   add document (scan / photos / files)
    document/[id].tsx         protected viewer
    category/[id].tsx, search.tsx, categories.tsx
    settings/                 security, change-pin, privacy, notifications, terms,
                              privacy-policy, about, danger (delete all / destroy)
src/
  crypto/core.ts              AES-256-GCM, HKDF, scrypt key wrap, PIN policy (pure TS, unit-tested)
  vault/keyManager.ts         Keychain / Keystore key handling, unlock modes, lockout
  vault/storage.ts            encrypted on-disk format, atomic writes, orphan sweep
  vault/VaultContext.tsx      vault state machine, auto-lock, document operations
  security/                   re-auth modal, privacy shield, secure temp files, importers
  notifications/scheduler.ts  private local reminders
  viewer/                     locked-down WebView viewer + offline pdf.js
  content/legal.ts            Terms & Conditions and Privacy Policy text
modules/docsave-security/     local native module (Swift + Kotlin):
                              iOS backup exclusion, root / jailbreak / Frida checks
plugins/                      config plugins: Android no-backup rules, no remote push
scripts/                      pdf.js embedding (postinstall), icon generator
__tests__/                    crypto, key manager, privacy and viewer tests
```

---

## Getting started

Requirements: Node 20+, and an [Expo account](https://expo.dev) for cloud builds. Docsave uses native modules (Keychain/Keystore biometrics, a local security module), so it runs in a **development build**, not Expo Go.

```powershell
npm install
```

```powershell
npm test
```

```powershell
npm run typecheck
```

### Run on a device or emulator

Android (works on Windows, macOS and Linux; needs Android Studio):

```powershell
npx expo run:android
```

iOS (needs macOS with Xcode):

```powershell
npx expo run:ios
```

Or build a development client in the cloud and install it on your phone:

```powershell
npm run build:dev
```

```powershell
npm start
```

### Release builds

The store identifier is `ivanbaal2.docsave.com` (set in [app.config.js](app.config.js); never change it after the first upload).

```powershell
npx eas-cli build -p android --profile production
```

```powershell
npx eas-cli build -p ios --profile production
```

The `preview` and `production` profiles set `DOCSAVE_PROFILE=production`, which removes the Android `INTERNET` permission. The OS then blocks every network connection from the app.

For iOS, enable the **Data Protection** capability (Complete) on the App ID; EAS does this automatically when it syncs capabilities. Push Notifications is **not** required.

---

## Before publishing

Everything needed for the stores (texts, form answers, review notes, screenshot sizes, checklist) is in [STORE_LISTING.md](STORE_LISTING.md). The public Privacy Policy and Terms pages are generated into `docs/` with `npm run legal:pages` and served by GitHub Pages.

1. **Legal review.** [src/content/legal.ts](src/content/legal.ts) contains complete Terms & Conditions and Privacy Policy drafts that match the implementation. A lawyer must review them for each country you distribute in, and you must replace every `[BRACKETED]` placeholder (publisher, address, contact, governing law). Bump the version when the text changes.
2. **Store privacy labels.** App Store "Data Not Collected" / Google Play Data safety "No data collected / shared" match this implementation. Re-check them if you add any SDK.
3. **Export compliance (iOS).** Docsave uses standard encryption (AES) to protect user data. Decide on `ITSAppUsesNonExemptEncryption` with your legal adviser and set it in `ios.infoPlist`.
4. **Security review.** Have an independent mobile-security audit done before launch (see SECURITY.md, "Limitations").
5. **Artwork.** [scripts/generate-icons.js](scripts/generate-icons.js) generates a clean placeholder icon. Replace it with designer artwork if you like.

---

## Tech stack and libraries

| Purpose | Library |
|---|---|
| AES-256-GCM, HKDF-SHA256, scrypt | `@noble/ciphers`, `@noble/hashes` (audited, zero-dependency) |
| Key storage + biometric gating | `expo-secure-store` (Keychain / Android Keystore) |
| Biometric checks | `expo-local-authentication` |
| CSPRNG | `expo-crypto` (`SecRandomCopyBytes` / `SecureRandom`) |
| Binary file I/O | `expo-file-system` (SDK 58 `File` API) |
| Camera / import | `expo-camera`, `expo-image-picker`, `expo-document-picker` |
| Screenshot / app-switcher protection | `expo-screen-capture` |
| PDF rendering | `pdfjs-dist` (bundled into the app, rendered in a sandboxed WebView) |
| Local reminders | `expo-notifications` (local only) |
