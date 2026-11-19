# Encryption export compliance (App Store)

**Status: NOT DETERMINED. No exemption is assumed.** `ITSAppUsesNonExemptEncryption` has been removed from `app.config.js`, so App Store Connect will ask the questions at upload.

## Facts about Docsave's cryptography
- AES-256-GCM (Apple CryptoKit on iOS, Conscrypt/BoringSSL on Android, @noble/ciphers in JS), PBKDF2-HMAC-SHA256 (CommonCrypto), HKDF-SHA256.
- Purpose: protecting the user's own data at rest on their device (password/PIN-protected storage).
- No network communication, no proprietary or non-standard algorithms, no crypto offered to other apps or users as a service.

## What must be verified (by the owner, ideally with an adviser)
1. Whether this use falls under the US EAR "mass market" / Note 3 or the "data at rest" provisions of Category 5 Part 2 (e.g. 5A992.c / 740.17(b)(1)), and therefore whether a self-classification report is required (submitted annually to BIS by 1 February for 740.17(b)(1) items).
2. Whether French encryption declaration requirements apply for distribution in France (Apple asks this separately).
3. Record the decision, and the documentation supporting it, in this file before the first upload. Then set `ITSAppUsesNonExemptEncryption` accordingly.

Apple reference: "Complying with encryption export regulations" (developer.apple.com) and the questionnaire in App Store Connect.
