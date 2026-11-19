# Docsave store listing kit

Copy-paste text and form answers for **Google Play Console** and **App Store Connect**.

| Item | Value |
|---|---|
| App name | Docsave |
| App ID / bundle ID | `ivanbaal2.docsave.com` (permanent) |
| Developer | Ivan Baal (individual), Philippines |
| Support email | `[SUPPORT EMAIL]` (create a dedicated address first) |
| Privacy Policy URL | https://ivanbaal2.github.io/DocSave/privacy-policy.html |
| Terms URL | https://ivanbaal2.github.io/DocSave/terms.html |
| Website / marketing URL | https://ivanbaal2.github.io/DocSave/ |
| Category | Play: **Productivity** · App Store: **Productivity** (secondary: Utilities) |
| Price | Free, no in-app purchases, no ads |

---

## Texts

**Subtitle (App Store, max 30)**
```
Encrypted document vault
```

**Short description (Google Play, max 80)**
```
Encrypt your passport, ID & tickets on your phone. No cloud, no account.
```

**Promotional text (App Store, max 170)**
```
Keep your passport, ID cards and travel documents encrypted on your own phone — protected by Face ID and PIN. No account, no cloud, no tracking.
```

**Keywords (App Store, max 100, comma-separated)**
```
passport,id card,document,vault,encrypted,secure,wallet,travel,ticket,private,offline,scanner,safe
```

**Full description (both stores, max 4000)**
```
Docsave is a private vault for your most important documents — passport, national ID card (front and back), driving licence, residence permit, plane and train tickets, boarding passes, hotel bookings, certificates, contracts, receipts and more.

YOUR DOCUMENTS. YOUR DEVICE. YOUR PRIVACY.
Every document is encrypted on your phone with AES-256-GCM before it is saved. The encryption key is generated on your device and protected by your phone's secure hardware (Apple Keychain / Android Keystore), your PIN and, if you choose, Face ID or fingerprint.

NO ACCOUNT. NO CLOUD. NO TRACKING.
• No registration, no email, no password reset servers
• Nothing is uploaded, synced or backed up — Docsave has no servers
• No advertising, no analytics, no third-party trackers
• Works completely offline

BUILT FOR SECURITY
• AES-256-GCM authenticated encryption with tamper detection
• Unlock with PIN, Face ID / fingerprint, or require both (two-factor)
• Automatic locking when you leave the app
• Protection against repeated wrong PINs, with optional auto-erase
• Content hidden in the app switcher; screenshots blocked
• No unencrypted thumbnails or temporary copies
• Warning on rooted or jailbroken devices

SCAN, IMPORT AND ORGANISE
• Scan passports and ID cards with a guided camera frame, front and back
• Import photos and PDF files
• Identity, Travel, Personal and Other categories, plus your own folders
• Notes and expiry dates, searchable instantly
• Secure viewer with zoom and front/back switching

PRIVATE REMINDERS
Optional reminders before your passport, ID or other documents expire. Notifications never show document names, numbers or details.

IMPORTANT: NO RECOVERY
Because only you hold the keys, nobody — not even the developer — can recover your vault if you forget your PIN or lose your phone. Always keep your original documents. A digital copy is not an official document and may not be accepted by authorities, airlines or other organisations.
```

**What's new (version 1.0.0)**
```
First release of Docsave — your private, encrypted document vault.
```

---

## Google Play: Data safety form
- Does your app collect or share any of the required user data types? → **No**
- (Explains why: all data stays on the device, encrypted. Data processed only on the device is not "collected".)
- Is all of the user data collected by your app encrypted in transit? → not applicable (no data collected)
- Do you provide a way for users to request that their data is deleted? → not applicable. Users can delete everything in the app.

## Google Play: other declarations
- **Ads:** No ads
- **App access:** All functionality is available without special access. Note for reviewers: "On first launch, create any 6-digit PIN (e.g. 480317). No login or account exists."
- **Content rating (IARC questionnaire):** category *Utility / Productivity*; answer **No** to violence, sexual content, gambling, user interaction / chat, sharing location, and purchases. Expected rating: Everyone / 3+.
- **Target audience:** 18+ (handles identity documents)
- **Permissions:** Camera, used to scan documents. Biometric, used to unlock the vault. Notifications, used for optional expiry reminders.
- **Government apps / financial features / health:** No

## App Store Connect: App Privacy
- Data collection → **"No, we do not collect data from this app"** → label shows **Data Not Collected**

## App Store Connect: other
- **Age rating:** answer "None" to all → 4+
- **Export compliance:** "Uses encryption" → Yes → "only standard encryption / exempt" (already declared via `ITSAppUsesNonExemptEncryption = false`)
- **Sign-in required:** No
- **Review notes:**
  ```
  Docsave has no account or login. On first launch, accept the no-recovery notice, Terms and Privacy Policy, then create any 6-digit PIN (for example 480317) and optionally enable Face ID. All data is stored encrypted on the device only; the app makes no network requests. Camera is used only to scan documents the user chooses to add.
  ```

---

## Screenshots you need

| Store | Required sizes |
|---|---|
| Google Play | Phone: 2–8 screenshots (16:9 or 9:16, min 1080 px side). **Feature graphic 1024 × 500** (required). App icon 512 × 512. |
| App Store | iPhone 6.9" (1320 × 2868) or 6.7" (1290 × 2796): 1–10 screenshots |

Suggested shots: 1 Welcome screen, 2 Dashboard, 3 Scan passport frame, 4 Add document (front/back), 5 Secure viewer, 6 Security settings. Use **sample or fake documents only**, never real ID data, in screenshots.

---

## Release checklist

- [ ] Create the support email, replace `[SUPPORT EMAIL]` in `src/content/legal.ts`, run `npm run legal:pages`, commit
- [ ] Enable GitHub Pages: repo **Settings → Pages → Deploy from branch → main / docs**
- [ ] Optional but recommended: legal review of Terms & Privacy Policy
- [ ] Google Play Console account ($25) → create app → closed test with 12+ testers for 14 days (new personal accounts)
- [ ] Apple Developer Program ($99/yr) → App Store Connect → new app with bundle ID `ivanbaal2.docsave.com`
- [ ] `eas build -p android --profile production` and `eas build -p ios --profile production`
- [ ] `npm run submit:android` / `npm run submit:ios`
- [ ] Fill in listing, Data safety / App Privacy, content rating, screenshots → submit for review
