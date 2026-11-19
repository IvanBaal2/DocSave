/**
 * Legal texts shown in the app and on the website (scripts/build-legal-pages.mjs).
 *
 * STATUS: DRAFT — NOT LEGALLY REVIEWED. These texts describe the implemented
 * app accurately (see compliance/GDPR_ASSESSMENT.md), but they must be reviewed
 * by a lawyer qualified in Spanish / EU law before release, and every
 * "to be provided by the publisher" value must be supplied by the publisher.
 * Nothing here may be invented. Bump the version whenever the text changes:
 * the app records which version the user accepted and when.
 */

export type LegalSection = { heading: string; body: string[] };
export type LegalDocument = {
  title: string;
  version: string;
  updated: string;
  status: 'draft' | 'final';
  sections: LegalSection[];
};

/** Placeholder for information only the publisher can provide. */
const MISSING = (what: string) => `[${what} — to be provided by the publisher]`;

export const PUBLISHER = 'Ivan Baal';
export const PUBLISHER_STATUS = MISSING('legal status: individual developer, self-employed (autónomo) or company');
export const ADDRESS = MISSING('postal address');
export const COUNTRY = MISSING('country of establishment');
export const CONTACT = 'u2648454771@id.gle';
export const GOVERNING_LAW = MISSING('governing law and competent courts');
export const WEBSITE = 'https://ivanbaal2.github.io/DocSave/docs/';
const EFFECTIVE = MISSING('effective date (set on publication)');

export const PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  version: '2.0-draft',
  updated: '19 November 2026',
  status: 'draft',
  sections: [
    {
      heading: '1. Who we are',
      body: [
        `Docsave is published by ${PUBLISHER}, ${PUBLISHER_STATUS}, ${ADDRESS}, ${COUNTRY}.`,
        `Privacy and support contact: ${CONTACT}. Website: ${WEBSITE}`,
      ],
    },
    {
      heading: '2. What Docsave does',
      body: [
        'Docsave is a personal app for keeping copies of your own documents (for example passports, ID cards, driving licences, tickets, certificates and cards) in an encrypted vault on your phone.',
      ],
    },
    {
      heading: '3. Summary',
      body: [
        'Your documents are stored only on your device and are encrypted there before they are saved.',
        'Docsave has no user accounts, no cloud synchronisation and no Docsave servers. The app never sends your documents, their contents or the details read from them to us or to anyone else.',
        'We do not use advertising, analytics or tracking.',
      ],
    },
    {
      heading: '4. Information processed on your device',
      body: [
        'Docsave processes, only on your device: the images and files you add; details read from them (such as names, document numbers, dates of birth and expiry, nationality, travel details or card numbers); names, notes, categories and dates you enter; your app settings; an encrypted copy of the vault key protected by your PIN; a counter of failed PIN attempts; the version and date of the Terms and Privacy Policy you accepted; and, if the app closes unexpectedly, a technical error report (no document content) shown to you once at the next start.',
        'This processing is carried out by the app on your device for you. We, the publisher, do not receive, see or store any of this information.',
      ],
    },
    {
      heading: '5. Passports, identity documents and other people’s documents',
      body: [
        'Identity documents contain sensitive information such as document numbers and a photo of the holder. Docsave reads text from them on your device; it does not analyse faces and does not use the photo to identify anyone.',
        'You may store documents of family members or other people only where you are entitled to do so, for example as a parent or guardian, and you are responsible for keeping them confidential.',
      ],
    },
    {
      heading: '6. Camera',
      body: [
        'The camera is used only when you choose to scan a document or read a barcode. While you scan, small preview images are analysed in the device memory to detect the document; temporary camera files are deleted immediately and the final image is encrypted before it is saved.',
        'The camera may use the flash automatically for the final photo in low light.',
      ],
    },
    {
      heading: '7. Photos and files you import',
      body: [
        'Docsave uses your phone’s system photo picker and document picker, so it can read only the items you select. It does not request general access to your photos or storage. Temporary copies made by the system pickers are deleted after encryption.',
      ],
    },
    {
      heading: '8. Automatic text recognition (OCR)',
      body: [
        'Text recognition runs on your device: on Android it uses the Google ML Kit text-recognition model included in the app; on iPhone it uses Apple’s Vision framework. Images and recognised text are not uploaded.',
        'On Android, the release version of Docsave does not request the Internet permission, so the operating system prevents the app and its components from connecting to the internet.',
      ],
    },
    {
      heading: '9. Face and fingerprint unlock',
      body: [
        'If you enable it, your phone’s operating system verifies your face or fingerprint. Docsave never receives, stores or processes your biometric data or templates; it only receives a yes/no result from the system.',
      ],
    },
    {
      heading: '10. Local storage and encryption',
      body: [
        'Documents and their details are encrypted on your device with AES-256-GCM before being written to the app’s private storage. The encryption key is generated on your device and protected by your PIN and the phone’s secure key store (Android Keystore / Apple Keychain).',
        'Docsave’s data is excluded from cloud and computer backups and from device-to-device transfers. No security measure is perfect; see section 21.',
      ],
    },
    {
      heading: '11. Document details (metadata)',
      body: [
        'Names, notes, categories, dates and recognised details are stored in an encrypted index inside the vault. They are searchable only inside the unlocked app and are not added to any system search index.',
      ],
    },
    {
      heading: '12. Notifications',
      body: [
        'Reminders are optional, created and delivered on your device, and never include document names, numbers or contents. Docsave does not use a push-notification server.',
      ],
    },
    {
      heading: '13. Diagnostics',
      body: [
        'Docsave contains no analytics or crash-reporting service. If the app closes unexpectedly, a technical error report is kept on your device and shown to you once; it is not sent anywhere.',
        'If you turn on “Diagnostics sharing” (off by default), you can create a short technical report (app and system version, security-check results and number of documents — never document names or contents) and send it yourself through your phone’s share menu. If you send it to us, we process it as described in section 16.',
      ],
    },
    {
      heading: '14. Third-party components',
      body: [
        'Docsave is built with open-source components (including React Native and Expo libraries and Mozilla pdf.js) and, on Android, the Google ML Kit text-recognition model. These components run inside the app on your device; Docsave does not give them your data and, on Android, the app cannot connect to the internet. A full list is published in the app’s software bill of materials.',
      ],
    },
    {
      heading: '15. Sharing your information',
      body: [
        'We do not sell, rent or share your information. A document leaves Docsave only if you choose to export it through your phone’s share menu; from that moment the copy is under your control and no longer protected by Docsave.',
      ],
    },
    {
      heading: '16. When you contact us',
      body: [
        'If you email us (for support, a privacy request or a diagnostics report), we process your email address and the content of your message to answer you. Legal basis: our legitimate interest in answering your request and, where applicable, our legal obligations (GDPR art. 6(1)(f) and (c)).',
        `We keep this correspondence only as long as needed to handle your request and any related legal obligation ${MISSING('retention period for support correspondence')}. Our email provider ${MISSING('email provider and transfer safeguards, if outside the EEA')} processes it on our behalf. Never send copies of your documents by email.`,
      ],
    },
    {
      heading: '17. International transfers',
      body: ['The app itself does not transfer your information anywhere. Transfers can only occur for emails you send us, as described in section 16.'],
    },
    {
      heading: '18. How long information is kept',
      body: [
        'Your vault stays on your device until you delete documents, delete all documents, permanently destroy the vault, or uninstall the app. Because there is no backup, deleted information cannot be restored.',
      ],
    },
    {
      heading: '19. Deleting your information',
      body: [
        'You can delete a single document, delete all documents, or permanently destroy the vault (which erases the encryption keys, making any remaining encrypted data unreadable). Phone storage cannot always be overwritten in place, so deletion is not a forensic erasure, but without the keys the encrypted data cannot be read.',
      ],
    },
    {
      heading: '20. Your rights',
      body: [
        'Under the GDPR you have rights of access, rectification, erasure, restriction, objection and portability. For information on your device, you exercise them directly in the app (Settings → Your privacy rights): view, edit, export and delete. For information you sent us by email, contact us and we will answer within one month.',
        'You can complain to a data-protection authority, in Spain the Agencia Española de Protección de Datos (www.aepd.es).',
      ],
    },
    {
      heading: '21. Security limitations and incidents',
      body: [
        'No app can fully protect information on a device that is rooted, jailbroken or infected with malware, or against someone who knows your PIN. Docsave refuses to unlock when it detects signs of a rooted or jailbroken device, but detection is not guaranteed.',
        'If we become aware of a security problem in Docsave, we will fix it, inform users through an app update and our website, and notify authorities where the law requires it.',
      ],
    },
    {
      heading: '22. Children',
      body: ['Docsave is not intended for use by children on their own. Parents or guardians may store documents of their children in their own vault.'],
    },
    {
      heading: '23. Changes to this policy',
      body: ['If this policy changes, we will publish the new version on our website and describe the change in the app’s update notes. The version and date you accepted at setup are stored only on your device.'],
    },
    {
      heading: '24. Effective date and contact',
      body: [`Effective date: ${EFFECTIVE}.`, `Contact: ${PUBLISHER}, ${CONTACT}.`],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: 'Terms & Conditions',
  version: '2.0-draft',
  updated: '19 November 2026',
  status: 'draft',
  sections: [
    {
      heading: '1. Publisher',
      body: [`Docsave is provided by ${PUBLISHER}, ${PUBLISHER_STATUS}, ${ADDRESS}, ${COUNTRY}. Contact: ${CONTACT}.`],
    },
    {
      heading: '2. What Docsave is',
      body: [
        'Docsave is an app for keeping encrypted copies of your personal documents on your own device. Docsave is free; there are no paid features, subscriptions or advertising.',
        'Docsave does not issue, verify, certify or replace any official document. A copy stored in Docsave is not an official document.',
      ],
    },
    {
      heading: '3. Who may use Docsave',
      body: [
        `You must be an adult with legal capacity, or use Docsave under the supervision of a parent or guardian ${MISSING('minimum age, to be confirmed in legal review')}.`,
      ],
    },
    {
      heading: '4. Permitted use',
      body: ['You may use Docsave to store and view documents that you are entitled to possess and copy, including documents of family members you are responsible for.'],
    },
    {
      heading: '5. Prohibited use',
      body: [
        'You must not use Docsave to forge, alter or misuse documents, to store documents you are not entitled to hold, to break the law, or to reverse-engineer or interfere with the app’s security beyond what the law allows.',
      ],
    },
    {
      heading: '6. Your responsibilities',
      body: [
        'Keep your PIN secret and choose one others cannot guess, protect your phone with a screen lock, keep your operating system up to date, and check details read automatically before relying on them.',
        'Always keep separate copies or the originals of documents you may need for travel, emergencies or official procedures.',
      ],
    },
    {
      heading: '7. Your documents',
      body: ['You keep all rights in your documents. We claim no ownership of them and have no access to them.'],
    },
    {
      heading: '8. Intellectual property and licence',
      body: [
        `Docsave, its name and design belong to ${PUBLISHER}. You receive a personal, non-exclusive, non-transferable licence to use the app. Open-source components remain subject to their own licences (see the software bill of materials).`,
      ],
    },
    {
      heading: '9. Encryption and security',
      body: [
        'Docsave encrypts documents on your device and uses the phone’s secure key store. No security is absolute: Docsave cannot protect your information on a compromised (rooted, jailbroken or infected) device, from someone who knows your PIN, or from someone who can unlock your phone with your biometrics.',
      ],
    },
    {
      heading: '10. Local storage only',
      body: ['Documents are stored only on the device where you added them. Docsave provides no cloud storage or synchronisation.'],
    },
    {
      heading: '11. No recovery',
      body: [
        'There is no recovery service. Nobody, including the publisher, can open your vault or reset your PIN. Your documents are permanently lost if you forget your PIN, lose or reset your device, uninstall Docsave, enable auto-erase and enter the wrong PIN too many times, or — in two-factor mode — your enrolled biometrics change.',
      ],
    },
    {
      heading: '12. Deleting documents',
      body: ['Deleted documents and a destroyed vault cannot be restored.'],
    },
    {
      heading: '13. Device loss, migration and uninstalling',
      body: [
        'The vault is not transferred to a new phone and is removed when the app is uninstalled or the phone is reset. To move documents, export them from the old device before changing phones.',
      ],
    },
    {
      heading: '14. Supported devices',
      body: [
        'Docsave requires Android 8.0 or later or iOS 16.4 or later. Docsave will not unlock on devices that show signs of rooting or jailbreaking. Some features (face or fingerprint unlock, automatic recognition) depend on the device.',
      ],
    },
    {
      heading: '15. Availability and updates',
      body: [
        'Docsave works offline. We may publish updates to improve security or functionality; we recommend installing them. We may stop distributing Docsave, which does not affect documents already on your device.',
      ],
    },
    {
      heading: '16. Acceptance of digital copies',
      body: ['Whether a digital copy is accepted is decided by each authority, airline, employer or service provider. Docsave cannot guarantee acceptance.'],
    },
    {
      heading: '17. Security vulnerabilities',
      body: [`If you discover a security vulnerability, please report it privately to ${CONTACT}. Do not publish it before it has been fixed.`],
    },
    {
      heading: '18. Support and complaints',
      body: [
        `For support or complaints, write to ${CONTACT}. We will acknowledge your message and aim to respond within ${MISSING('response time commitment')}. Never send copies of your documents.`,
      ],
    },
    {
      heading: '19. Your consumer rights',
      body: ['Nothing in these Terms limits the rights you have as a consumer under the law of your country of residence.'],
    },
    {
      heading: '20. Liability',
      body: [
        'Docsave is provided free of charge. To the extent permitted by law, the publisher is not liable for indirect loss, loss of documents that results from the no-recovery design described in section 11, or refusals by third parties to accept digital copies.',
        'Nothing in these Terms excludes or limits liability that cannot be excluded or limited by law, including liability for intent or gross negligence and for death or personal injury caused by negligence.',
      ],
    },
    {
      heading: '21. Ending use',
      body: ['You can stop using Docsave at any time by destroying the vault or uninstalling the app.'],
    },
    {
      heading: '22. Changes to these Terms',
      body: ['If these Terms change, we will publish the new version on our website and describe the change in the app’s update notes. The version and date you accepted at setup are stored only on your device.'],
    },
    {
      heading: '23. Governing law and disputes',
      body: [
        `${GOVERNING_LAW}. If you are a consumer, you also benefit from the mandatory protections of the law of your country of residence and may bring proceedings in the courts of that country.`,
      ],
    },
    {
      heading: '24. Contact',
      body: [`${PUBLISHER} — ${CONTACT}`],
    },
  ],
};
