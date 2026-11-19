# Incident response plan

Owner: Ivan Baal (publisher) · Contact: u2648454771@id.gle · Escalation chain: **[to be provided by the publisher]**

## 1. What counts as an incident
- A vulnerability that could expose vault data, for example a crypto flaw, a key leak, a bypass of lock or integrity checks, or a leak through export, temp files, logs or backups.
- A compromised build pipeline, signing key or developer account (Expo, GitHub, Google Play, Apple).
- A personal-data breach affecting data the publisher controls (the support mailbox).

## 2. Steps
1. **Receive and log**: date, reporter, description. Acknowledge within 72 h.
2. **Assess**: reproduce it, and rate severity (CVSS). Decide whether user data could be affected.
3. **Contain**: for a pipeline or key compromise, rotate the credentials (`eas credentials`, GitHub tokens) and pause store releases.
4. **Fix**: patch, add a regression test, run the full test suite, ship a build, and request expedited review if critical.
5. **Notify**:
   - **GDPR art. 33**: a breach of publisher-controlled personal data (the support mailbox) that is likely to result in risk is notified to the supervisory authority (AEPD, if established in Spain) within 72 h. **Art. 34**: affected people are told when the risk is high.
   - Vault data never reaches the publisher. A vulnerability in the app is not by itself a breach of publisher-controlled data. Users are told through release notes and the website, with clear guidance.
   - **CRA art. 14** (if the CRA applies; see GDPR_ASSESSMENT §9): an actively exploited vulnerability or a severe incident is reported to the CSIRT and ENISA: early warning within 24 h, notification within 72 h, final report within 14 days (vulnerability) or one month (incident).
6. **Review**: write a post-incident note in this folder and update the threat model.

## 3. Records
Keep the breach register (GDPR art. 33(5)) even when no notification is required. Location: **[to be provided by the publisher]**.
