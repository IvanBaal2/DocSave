# Docsave test plan

## Automated tests (`npm test`): 44 tests

| Suite | Covers |
|---|---|
| `__tests__/crypto.test.ts` | AES-256-GCM round trip (256 KB), ciphertext contains no plaintext, random nonces, **tamper detection** on every byte region, truncation and bad header, **blob swapping** between objects is rejected, **wrong key / key loss**, per-object key derivation, invalid key and id rejection, PIN wrap/unwrap, wrong PIN, tampered wrapped key, **KDF downgrade refusal**, PIN policy, RNG failure guard |
| `__tests__/keyManager.test.ts` | PIN-only, biometric-or-PIN and **two-factor** modes; the raw key is never stored without a biometric gate; biometric cancel → PIN fallback; **biometric enrolment change makes a two-factor vault unrecoverable**; PIN change keeps the master key and invalidates the old PIN; mode switching removes stale keys; **key loss** after destroying keys; lockout schedule; persistent failed-attempt counter |
| `__tests__/privacy.test.ts` | Notification text never contains names, numbers or types; generic mode hides even the category; reminder planning (6 months / lead / 7 / 0 days, travel 7 / 1 days, iOS 64-notification cap); viewer CSP blocks all network; HTML escaping; MIME injection |

Also checked during development:

```powershell
npm run typecheck
```

```powershell
npx expo-doctor
```

```powershell
npx expo export --platform android --platform ios
```

```powershell
$env:DOCSAVE_PROFILE="production"; npx expo prebuild --platform android --no-install
```

Then check `android/app/src/main/AndroidManifest.xml`. It must have `INTERNET` set to `tools:node="remove"`, `allowBackup="false"` and `dataExtractionRules`.

## Manual device test checklist

Run on a real Android phone and a real iPhone using a **release** build (the `preview` profile).

### Setup and authentication
- [ ] Fresh install shows onboarding. You can't continue without each acknowledgement or acceptance.
- [ ] Weak PINs (123456, 111111) are rejected. Mismatched confirmation restarts PIN creation.
- [ ] Cancelling the biometric prompt during setup shows an error, and "PIN only" works.
- [ ] Killing the app mid-setup leaves no vault, and onboarding restarts.
- [ ] Biometric-or-PIN: Face ID / fingerprint unlocks, cancelling falls back to the PIN keypad.
- [ ] Two-factor: biometrics first, then PIN. A wrong PIN is rejected.
- [ ] 5 wrong PINs trigger a 30 s lockout that survives an app restart, followed by escalating delays.
- [ ] With auto-erase on, 10 wrong PINs destroy the vault and onboarding appears.

### Unauthorized access
- [ ] Each auto-lock setting (immediately, 30 s, 1 min, 5 min) locks after backgrounding for that long.
- [ ] 5 minutes idle in the foreground locks the vault.
- [ ] Open document → background → return: the viewer asks to authenticate again.
- [ ] The app switcher shows the Docsave shield, not content (both OSes).
- [ ] Android: screenshots and screen recording show black. iOS: screen recording hides content.
- [ ] A deep link (`docsave://document/<id>`) while locked lands on the lock screen.
- [ ] Opening the file picker or camera with "Immediately" auto-lock does not lose the Add flow.

### Encryption and tampering (debug build + adb / Xcode container download)
- [ ] `files/docsave-vault/blobs/*.enc` start with `DSV1`, and `strings` shows no document text.
- [ ] Flip one byte of a blob → the viewer shows "Integrity check failed".
- [ ] Flip one byte of `index.enc` → unlock reports "Vault integrity check failed".
- [ ] Copy blob A over blob B → B fails the integrity check (object binding).
- [ ] After importing, the `cache/DocumentPicker`, `cache/ImagePicker` and `cache/Camera` folders are empty.

### Key loss, reinstall, backup, migration
- [ ] Android: uninstall and reinstall → fresh onboarding (keystore and files gone).
- [ ] iOS: uninstall and reinstall → fresh onboarding. Keychain leftovers are detected (vault id mismatch) and wiped.
- [ ] iOS: add or remove a fingerprint / re-enrol Face ID → biometric-or-PIN falls back to PIN. In two-factor mode the vault reports the key is unavailable (documented no-recovery behaviour).
- [ ] Android: `adb backup` / `bmgr backupnow <package>` produces no Docsave data.
- [ ] Android 12+ device-to-device transfer (Pixel / Samsung Smart Switch) does not move the vault.
- [ ] iOS: an encrypted Finder / iCloud backup restored to a second device does not contain a usable vault.
- [ ] "Permanently destroy vault" → onboarding, and the old PIN no longer works.

### Documents
- [ ] Passport front + back via the camera, ID card front + back via photos, a PDF via files.
- [ ] Multi-page PDF renders all pages offline (airplane mode), and pinch-zoom works.
- [ ] Front/back tabs and the swap button work.
- [ ] Rename, edit notes, category and expiry, delete, delete all documents.
- [ ] Custom folder: create, add a document, delete the folder → the document moves to Other.
- [ ] Unsupported file types (for example .docx) are stored, and the viewer explains why there is no preview.

### Notifications
- [ ] Turning on asks for permission. Denying it offers to open settings.
- [ ] The test notification shows generic text only, and the lock-screen preview contains no details.
- [ ] Set a passport expiry 31 days out with lead time 30 → a reminder arrives at 09:00 the next day.
- [ ] Turning notifications off cancels all scheduled reminders.

### Accessibility and layout
- [ ] VoiceOver / TalkBack read every button, PIN-pad key, toggle and checkbox.
- [ ] Large font sizes, small phones (iPhone SE) and tablets lay out correctly.
