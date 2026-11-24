# Installing Docsave

## Test version on an Android phone (APK)

1. Open the APK link from the EAS build page on your phone and download it.
2. Tap the file. If Android asks, allow your browser to install apps (**Settings → Install unknown apps**).
3. **If an older Docsave test version is installed, uninstall it first.** Test versions signed with a different key cannot be installed over each other, and data from a test vault is not carried over (by design: no backups, no recovery).
4. **Huawei phones** show "Threat detected — does not meet Huawei quality and security standards" for every app installed from outside AppGallery. Huawei shows this because of where the app was installed from (see `SECURITY_AUDIT.md` §2). To proceed with a test build, choose **Install anyway / Continue**. Store releases through AppGallery don't show this.
5. Open Docsave and complete setup. The last step shows **"Your vault is ready"**. If fingerprint protection is not available on your phone, it tells you why and keeps the vault on your PIN.

## What to try

- **Add Document → Passport**: the camera opens. Hold the photo page inside the frame with the two `<<<` lines visible. Docsave captures automatically and fills in name, number, nationality, dates and sex.
- **Add Document → National ID Card**: capture the front, turn the card over when asked, capture the back.
- **Add Document → Boarding Pass**: point at the barcode; the flight details fill in.
- **Add Document → PDF Document**: pick a PDF file.
- Review the details (anything not recognised is marked), then **Encrypt & save**.

Taking screenshots inside Docsave is blocked on purpose (Settings → Privacy → Hide sensitive previews).

## Store builds

| Output | Command | Use |
|---|---|---|
| Android APK (test) | `npx eas-cli build -p android --profile preview` | install directly on phones |
| Android App Bundle (AAB) | `npx eas-cli build -p android --profile production` | upload to Google Play / AppGallery |
| iOS (App Store / TestFlight) | `npx eas-cli build -p ios --profile production` | needs an Apple Developer account ($99/year); EAS asks you to sign in to Apple during the first build |

Upload with `npm run submit:android` / `npm run submit:ios`. Store texts and form answers are in `STORE_LISTING.md`.

## Developers

```powershell
npm install
```

```powershell
npm test
```

```powershell
npm run typecheck
```

Native code (OCR, crypto) only runs in a development or release build, not in Expo Go:

```powershell
npx expo run:android
```

## Signing key (keep it safe)

Builds are signed with the upload key in `credentials/docsave-upload.jks`; its
passwords are in `credentials.json`. Both are deliberately **not** in git.

- Keep a backup of both files somewhere safe (for example an encrypted USB
  drive or a password manager). Without them, sideloaded installs cannot be
  updated and Google Play needs an upload-key reset.
- Never share them or commit them.
- Owner: `CN=Ivan Baal, O=Docsave` · SHA-256: `C2:1E:1B:53:BC:B6:11:56:8A:14:95:87:88:8D:E1:B6:8F:91:8A:91:75:F2:B6:A1:07:9F:40:EC:1B:47:FF:12`
- Apps signed with the earlier anonymous Expo key cannot be updated in place:
  uninstall them first (this deletes the vault on that phone).
