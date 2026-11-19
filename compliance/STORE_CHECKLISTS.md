# Store checklists

## Google Play
- [x] Target/compile SDK from Expo SDK 58. minSdk 26.
- [x] AAB production profile (`eas build -p android --profile production`).
- [x] Privacy Policy URL: https://ivanbaal2.github.io/DocSave/docs/privacy-policy.html (**DRAFT; finalise first**)
- [x] Data safety form, prepared answers: *No data collected; no data shared*. Data is processed only on the device, and Google's definition of "collection" covers data transmitted off the device. Encrypted at rest: yes (not "in transit": nothing is transmitted). Users can request deletion: yes, in-app.
- [x] No ads, no ad ID (`AD_ID` blocked), no account (account-deletion requirement not applicable).
- [x] Sensitive permissions: camera only. No storage, location or SMS.
- [ ] Developer account and identity verification (owner)
- [ ] Trader / DSA declaration with address (owner; OWNER_INFORMATION_REQUEST #2)
- [ ] Upload key with a named DN (audit F7)
- [ ] Content rating questionnaire
- [ ] Store listing screenshots from a release build
- [ ] Closed testing with the required number of testers (new personal accounts)

## Apple App Store
- [ ] Apple Developer Program enrolment (owner)
- [ ] iOS build (`eas build -p ios`) and TestFlight
- [x] Privacy manifest (`NSPrivacyTracking: false`; required-reason APIs declared in `app.config.js`)
- [x] App Privacy "nutrition label": *Data Not Collected*
- [ ] Export-compliance answer (EXPORT_COMPLIANCE.md)
- [ ] Trader status / DSA (EU)
- [ ] Review notes: explain the offline vault and the no-recovery design; no login needed
- [ ] Screenshots on the required device sizes

## Huawei AppGallery (optional)
- [ ] Developer account. Docsave needs no Google services. Not submitted; no approval claimed.
