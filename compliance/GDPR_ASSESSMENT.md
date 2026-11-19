# GDPR / LOPDGDD engineering assessment

Status: **engineering assessment, not legal advice.** It must be confirmed by a lawyer. Date: 19 November 2026. Based on the code at this commit.

## 1. Processing inventory

| Processing | Where | Who decides purpose and means | Data | Leaves the device? |
|---|---|---|---|---|
| Storing documents and their details in the vault | User's device | The user, using a tool | Document images and files; names, numbers, dates, nationality, MRZ, card and ticket data; notes | No (only by user-initiated export) |
| OCR and field extraction | User's device (ML Kit / Vision) | The user | Same | No |
| Biometric unlock | OS | The user and the OS | None reaches Docsave (yes/no result only) | No |
| Local reminders | User's device | The user | Expiry dates; generic notification text | No |
| Local crash record | User's device | Publisher (app design) | Error message and stack, no document content | No |
| Manual diagnostics report | User's device → user-chosen channel | The user decides to share | App/OS version, integrity results, document count | Only if the user sends it |
| Support and privacy email | Publisher's mailbox | **Publisher (controller)** | Email address, message, anything the user attaches | Yes, sent by the user |

## 2. Roles
- **In-app processing:** the publisher has no access to the data and does not process it. Data processed by an individual on their own device for personal purposes falls under the household exemption (GDPR art. 2(2)(c)) for the user. The publisher, as the provider of the tool, is not a controller of vault data, because it neither receives the data nor determines what is stored. GDPR Recital 18 notes that providers of the means for household processing remain subject to the GDPR for their own processing. Docsave applies data-protection-by-design (art. 25) principles anyway.
- **Support email:** the publisher is controller. Lawful basis: art. 6(1)(f) legitimate interest in responding, and 6(1)(c) where a legal duty applies, for example answering rights requests.

## 3. Special categories (art. 9)
- Identity documents are not special-category data in themselves. Photos of faces are biometric data only when processed by specific technical means for unique identification (art. 4(14)). Docsave does not do this: no face analysis. OCR reads text only.
- Users may store documents that reveal special categories (for example health cards, or religion on some documents). This happens under the household exemption. The publisher never receives it.
- Biometric unlock: handled entirely by the OS. Docsave receives no biometric data.

## 4. DPIA screening (art. 35, AEPD list of processing requiring a DPIA)
- The publisher does not carry out systematic processing of personal data through the app. It processes only support email, at small scale, with no profiling, no large-scale processing of special categories, no monitoring and no new-technology risk to others.
- **Engineering conclusion:** a DPIA does not appear mandatory for the publisher's own processing. **Recommended anyway** as voluntary good practice, given that identity documents are stored. This document and SECURITY_ARCHITECTURE.md can serve as its basis. A lawyer must confirm.

## 5. DPO (art. 37, LOPDGDD art. 34)
Not required based on the facts known: no core activity of large-scale monitoring or special-category processing, and the publisher is not in the LOPDGDD art. 34 list. Lawyer confirmation needed.

## 6. Data minimisation and by-design measures (art. 25)
- No account, no server, no analytics, ads or tracking SDKs.
- No INTERNET permission on Android release builds.
- Only filled fields are saved. Recognised raw text is shown, but only selected fields are kept.
- Excluded from OS backups. Screenshot and app-switcher protection.
- Temporary files are purged at launch and unlock. Export copies are deleted after 60 s.

## 7. Rights handling (arts. 12–22)
In-app: access (view), rectification (edit), erasure (delete one, delete all, destroy), portability (export through the share sheet), and withdrawing optional features (biometrics, reminders, diagnostics). Support email: answered within one month (art. 12(3)). See `app/(vault)/settings/rights.tsx`.

## 8. Children
Not directed at children. Parents may store children's documents in their own vault (household). Terms §3 minimum age: owner and lawyer to decide.

## 9. EU Cyber Resilience Act (Reg. (EU) 2024/2847)
- The CRA applies to products with digital elements **made available on the market in the course of a commercial activity**. Main obligations apply from 11 December 2027. Vulnerability and incident reporting (art. 14) applies from 11 September 2026.
- Whether a free app from an individual is "commercial activity" depends on the facts: for example monetisation, or whether the publisher is a business. **Owner and legal input required** (OWNER_INFORMATION_REQUEST.md #1).
- If it applies, Docsave is likely a "default" category product (not in Annex III/IV), which allows self-assessment (module A). Measures already in place that support CRA essential requirements: SBOM, vulnerability disclosure policy, secure-by-default configuration, minimal attack surface, data minimisation, security updates via the stores. Open items: formal risk assessment document, technical documentation file, EU declaration of conformity, support period statement, and an art. 14 reporting process to ENISA's single reporting platform.

## 10. Open legal questions for the lawyer
1. Confirm the household-exemption analysis and the publisher's role.
2. Confirm that no DPIA or DPO is required.
3. Review the Privacy Policy and Terms (Spanish versions may also be needed for Spanish consumers).
4. CRA applicability given the owner's status.
5. Consumer law (TRLGDCU) check of the Terms liability clause.
