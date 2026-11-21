# QA plan and evidence

## Automated (done; reproducible with `npm test`)
139 Jest tests: translations (7 languages, RTL); crypto format and tamper detection; key lifecycle with real PBKDF2; legacy re-wrap; extraction (MRZ TD1/TD2/TD3, licences, IDs, cards, boarding passes); privacy configuration (permissions, backup, plugins); 36 screen tests.

## Physical-device testing completed so far (owner reports)
- One Huawei Android phone, several preview builds. The issues found (vault creation, slow PIN, OCR, viewer crash, PIN rejection, setup crash) were fixed. Results are owner-reported; no formal test log was recorded.

## Still required before release (NOT DONE)

| Area | Devices / cases |
|---|---|
| Android matrix | At least Android 8, 10, 12, 14 and 15. Samsung, Pixel, Xiaomi, Huawei (no GMS). Small and large screens. |
| iOS matrix | iOS 16.4 minimum and the latest. Face ID and Touch ID devices. |
| Flows | Setup with and without biometrics; PIN only; two-factor; wrong-PIN limit and auto-erase; change PIN; scan each document type; import a PDF and photos; export; delete all; destroy; reminders; auto-lock; app switcher shield; screenshot block. |
| Edge cases | Biometrics changed; low storage; very large PDF; rotation; dark lighting; airplane mode; upgrade from 1.0 (scrypt re-wrap). |
| Accessibility | TalkBack and VoiceOver, large font, contrast |

Record each run (device, OS, build ID, result) in this file. Do not mark the device QA row done without recorded results.
