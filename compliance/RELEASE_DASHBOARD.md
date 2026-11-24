# Docsave release dashboard — version 1.1.0

Updated: 19 November 2026

## Verdict: **NOT READY FOR RELEASE**

Why: required legal identity information is missing (see [OWNER_INFORMATION_REQUEST.md](OWNER_INFORMATION_REQUEST.md)). The legal texts have not been reviewed by a lawyer. No independent security test or physical-device QA matrix has been completed. The spec says a release must be blocked while any of these remain open.

Status key: **DONE**: implemented and evidenced in this repository · **PARTIAL**: work exists but something is still open · **OWNER**: needs information or action only the publisher can provide · **EXTERNAL**: needs a third party (lawyer, tester, store) · **NOT STARTED**

| # | Area | Status | Evidence / what is open |
|---|---|---|---|
| 1 | Legal identity of publisher | **PARTIAL** | Provided 24 Nov 2026: Ivan Baal, individual developer, Pili, Camarines Sur, Philippines. Postal code and street address still missing (Play may ask for a full address). |
| 2 | GDPR / LOPDGDD assessment, DPIA screening | **PARTIAL** | [GDPR_ASSESSMENT.md](GDPR_ASSESSMENT.md) is an engineering assessment, not legal advice. Lawyer confirmation needed. |
| 3 | Privacy Policy | **PARTIAL** | v3.0 (24 Nov 2026), draft label removed by the publisher; Philippine Data Privacy Act and National Privacy Commission. Not reviewed by a lawyer. |
| 4 | Terms & Conditions | **PARTIAL** | v3.0 (24 Nov 2026), draft label removed by the publisher; users 18+ (under 18 with parent or guardian), Philippine law. Not reviewed by a lawyer. |
| 5 | Explicit acceptance at setup, version and date recorded | **DONE** | `app/onboarding/index.tsx` (both boxes required). `termsVersion`, `privacyVersion` and `acceptedAt` are stored at vault creation.  Open: no in-app re-acceptance prompt for existing users when the texts change. |
| 6 | No-recovery warning before vault creation | **DONE** | Welcome screen notice plus a required acknowledgement. |
| 7 | User rights (access, correct, delete, export, withdraw, contact) | **DONE** | `app/(vault)/settings/rights.tsx`, document Export (`src/security/exporter.ts`), Edit, Delete all, Destroy vault. |
| 8 | Storage and encryption | **DONE** | AES-256-GCM, Keystore/Keychain, PBKDF2-600k. Unit tests in `__tests__/crypto.test.ts` and `keyManager.test.ts`. See [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md). |
| 9 | On-device OCR | **DONE** | ML Kit bundled model (Android) and Vision (iOS). The Android release has no INTERNET permission. |
| 10 | Biometrics | **DONE** | OS prompt only; no biometric data handled. |
| 11 | Permissions inventory | **DONE** | [PERMISSIONS.md](PERMISSIONS.md) |
| 12 | Notifications | **DONE** | Local only, generic text, remote push stripped (`plugins/withNoRemotePush`). |
| 13 | Internal security audit | **DONE (internal)** | [../SECURITY_AUDIT.md](../SECURITY_AUDIT.md). Not a certification. |
| 14 | Independent penetration test | **NOT STARTED** | **EXTERNAL.** Docsave has **not** been penetration-tested. No claim is made. |
| 15 | Incident response plan | **PARTIAL** | [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md). Needs the owner's contact chain and a legal check of notification duties. |
| 16 | Vulnerability disclosure policy | **DONE** | [../SECURITY.md](../SECURITY.md) and [VULNERABILITY_DISCLOSURE.md](VULNERABILITY_DISCLOSURE.md). |
| 17 | SBOM | **DONE** | [sbom.cdx.json](sbom.cdx.json) (CycloneDX, `npm sbom --omit=dev`, 377 components). Native Gradle/CocoaPods dependencies are not included; see the licence inventory. |
| 18 | Licence inventory | **PARTIAL** | [LICENCES.md](LICENCES.md). Logo ownership must be confirmed by the owner. Google ML Kit terms must be accepted by the owner. |
| 19 | Encryption export compliance (iOS) | **OWNER/EXTERNAL** | [EXPORT_COMPLIANCE.md](EXPORT_COMPLIANCE.md). No exemption assumed. |
| 20 | Google Play checklist | **PARTIAL** | [STORE_CHECKLISTS.md](STORE_CHECKLISTS.md). Data-safety answers prepared; account, signing DN (audit F7) and listing upload are open. |
| 21 | App Store checklist | **OWNER** | Needs Apple Developer enrolment, an iOS build and the export-compliance answer. |
| 22 | EU Cyber Resilience Act assessment | **PARTIAL** | [GDPR_ASSESSMENT.md §9](GDPR_ASSESSMENT.md). Applicability depends on the owner's commercial status. |
| 23 | Financial transparency | **DONE** | Free app: no purchases, subscriptions, ads or data sales. See [SUPPORT_AND_FINANCE.md](SUPPORT_AND_FINANCE.md). |
| 24 | Automated tests | **DONE** | Jest: 161 tests passing (crypto, key management, extraction, classification and import validation, privacy configuration, translations in 7 languages, screen tests). See [../TESTING.md](../TESTING.md). |
| 25 | QA on physical devices | **PARTIAL** | Owner tested on one Huawei Android phone across several builds. No device matrix, no iPhone tests. See [QA_PLAN.md](QA_PLAN.md). |
| 26 | Data flow, retention, threat model | **DONE** | [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) |

## Claims we may NOT make (no evidence)
- "GDPR compliant" / "certified": no legal review or certification exists.
- "Penetration-tested", "audited by a third party", "malware-free certified".
- "Approved by Google", "approved by Huawei", "approved by Apple".
- "Military-grade encryption" (wording removed from the app).

## Claims supported by evidence in this repository
- Documents are encrypted with AES-256-GCM on the device (code and tests).
- The Android release build declares no INTERNET permission (`app.config.js`, `scripts/verify-apk.mjs`).
- No accounts, analytics, advertising or tracking SDKs (dependency list and SBOM).
