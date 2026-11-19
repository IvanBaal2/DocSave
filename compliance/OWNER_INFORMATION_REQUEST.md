# Information the publisher must provide before release

Nothing below may be invented. Each item blocks release until it is supplied, and the legal texts must then be regenerated (`src/content/legal.ts`, then `npm run legal:pages`).

| # | Needed | Where it is used | Notes |
|---|---|---|---|
| 1 | **Legal status**: individual (consumer/hobby), self-employed (*autónomo*) or company | Privacy §1, Terms §1, CRA assessment | If a company: legal name, registration number (NIF/CIF), registered office. |
| 2 | **Postal address** for legal notices | Privacy §1, Terms §1, store listings | Both Google Play and Apple show a trader address for traders under the EU Digital Services Act. |
| 3 | **Country of establishment** | Controller identity, applicable law, lead supervisory authority | The spec refers to Spain/AEPD. Earlier in the project the Philippines was given. Confirm which applies. |
| 4 | **Governing law and courts** | Terms §23 | Must respect consumer protections in the user's country. |
| 5 | **Effective date** of the final texts | Privacy §24 | Set on publication after legal review. |
| 6 | **Email provider** for `u2648454771@id.gle` and where it stores mail | Privacy §16 | Needed to state transfers and safeguards. Confirm the address is monitored. |
| 7 | **Retention period** for support emails | Privacy §16 | For example "deleted 12 months after the request is closed". |
| 8 | **Support response-time commitment** | Terms §18 | |
| 9 | **Minimum age** policy | Terms §3 | Spain: 14 for consent under LOPDGDD art. 7 (no consent-based processing occurs in-app; confirm with a lawyer). |
| 10 | **Logo ownership**: confirm you created or licensed `assets/brand` artwork | LICENCES.md | Provide a licence if it came from a designer or a generator with terms. |
| 11 | **Lawyer review** of the Privacy Policy and Terms | Release dashboard rows 2–4 | |
| 12 | **Export-compliance decision** (iOS) | EXPORT_COMPLIANCE.md | |
| 13 | **Upload keystore with a named DN** (audit F7) | Google Play / sideload trust | `eas credentials` |
| 14 | **Apple Developer and Google Play developer accounts** | Store submission | |
