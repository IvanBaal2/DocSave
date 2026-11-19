/**
 * Legal texts shown in-app.
 *
 * IMPORTANT: These are carefully drafted templates that accurately describe how
 * Docsave is implemented. Before publishing, they MUST be reviewed by a
 * qualified lawyer for every country where the app is distributed, and every
 * [BRACKETED] placeholder must be replaced. Bump the version string whenever
 * the text changes: users are asked to accept the new version.
 */

export type LegalSection = { heading: string; body: string[] };
export type LegalDocument = { title: string; version: string; updated: string; sections: LegalSection[] };

export const PUBLISHER = 'Ivan Baal';
// Public support / privacy contact shown in the app, website and store listings.
export const CONTACT = 'Docsave@gmail.com';

export const TERMS: LegalDocument = {
  title: 'Terms & Conditions',
  version: '1.1',
  updated: '19 November 2026',
  sections: [
    {
      heading: '1. Purpose of Docsave',
      body: [
        'Docsave is a private digital vault that lets you store copies of your personal documents — such as passports, identity cards, tickets, certificates and contracts — in encrypted form on your own device.',
        'Docsave is a storage and organisation tool. It does not issue, verify, certify or validate any document.',
      ],
    },
    {
      heading: '2. Acceptance',
      body: [
        'By completing the first-time setup and using Docsave you agree to these Terms. If you do not agree, do not use the app.',
      ],
    },
    {
      heading: '3. Local storage only',
      body: [
        'All documents are stored exclusively in the private storage of the device on which you added them. Docsave has no user accounts, no servers, no cloud storage and no synchronisation service.',
        'Docsave disables operating-system backups of its data, so your vault is not included in iCloud, Google or computer backups and is not transferred when you migrate to a new device.',
      ],
    },
    {
      heading: '4. Encryption and security',
      body: [
        'Every document is encrypted on your device with AES-256-GCM before it is written to storage. The encryption key is generated randomly on your device and is protected by your PIN and, if you enable it, by Face ID or fingerprint through the device’s secure hardware (Apple Keychain / Android Keystore).',
        'No security measure is perfect. Docsave cannot guarantee protection against a device that is compromised (for example rooted, jailbroken or infected with malware), against someone who knows your PIN, or against someone who can unlock the vault with your biometrics.',
      ],
    },
    {
      heading: '5. No recovery',
      body: [
        'Docsave has no recovery system. Neither the publisher nor anyone else holds a copy of your PIN, your encryption key or your documents.',
        'If you forget your PIN, lose or reset your device, uninstall the app, have the vault erased after too many incorrect PIN attempts (if you enabled that option), or — in two-factor mode — your enrolled biometrics change, your documents will be permanently and irreversibly lost.',
        'You are solely responsible for keeping your PIN safe and for keeping the original documents or other copies you may need.',
      ],
    },
    {
      heading: '6. Your responsibilities',
      body: [
        'You must only store documents that you are legally entitled to possess and copy.',
        'You are responsible for securing your device, choosing a PIN that others cannot guess, and keeping your operating system up to date.',
        'You must not use Docsave for any unlawful purpose, including forging or altering documents.',
      ],
    },
    {
      heading: '7. Limitations of digital documents',
      body: [
        'A copy of a document stored in Docsave is not an official document. Border authorities, airlines, police, banks, employers and other organisations may refuse digital copies and may require the original physical document or an official digital credential.',
        'Always carry the original documents required for your journey or transaction. Expiry reminders are a convenience only; you remain responsible for renewing documents on time.',
      ],
    },
    {
      heading: '7a. Automatic recognition',
      body: [
        'Docsave can read information such as names, document numbers and dates from your scans using text recognition that runs entirely on your device. Recognition can be incomplete or wrong. Docsave marks anything it could not read and never fills in guessed values, but you are responsible for checking the details before saving.',
      ],
    },
    {
      heading: '8. Notifications',
      body: [
        'Reminders are optional, created locally on your device and never include document names, numbers or contents. Delivery depends on your operating system and settings and is not guaranteed.',
      ],
    },
    {
      heading: '9. Disclaimer and limitation of liability',
      body: [
        'Docsave is provided “as is” and “as available”, without warranties of any kind, to the fullest extent permitted by law.',
        `To the maximum extent permitted by applicable law, ${PUBLISHER} shall not be liable for any loss of data, loss of documents, inability to access the vault, denied travel or services, or any indirect, incidental or consequential damages arising from the use of, or inability to use, Docsave.`,
        'Nothing in these Terms excludes or limits liability that cannot be excluded or limited under applicable law, including your statutory consumer rights.',
      ],
    },
    {
      heading: '10. Changes',
      body: [
        'We may update these Terms. When we do, the app will show the new version and ask you to accept it before continuing.',
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  version: '1.1',
  updated: '19 November 2026',
  sections: [
    {
      heading: 'Summary',
      body: [
        'Docsave does not collect, receive, store or share your documents or personal data. Everything stays encrypted on your device. We have no servers that could receive it.',
      ],
    },
    {
      heading: 'Documents are stored locally',
      body: [
        'Documents you add, together with their names, notes, categories and expiry dates, are stored only in Docsave’s private storage area on your device.',
      ],
    },
    {
      heading: 'Documents are encrypted on the device',
      body: [
        'Each document is encrypted with AES-256-GCM before being written to storage. The vault index (names, notes, dates) is encrypted the same way. The encryption key never leaves your device and is protected by the Apple Keychain or Android Keystore.',
        'Docsave does not create unencrypted thumbnails. Documents are decrypted only in memory while you view them.',
      ],
    },
    {
      heading: 'On-device recognition',
      body: [
        'When you scan a document, Docsave recognises its text on your phone to fill in details such as the holder name, document number, dates or flight details. On Android this uses the Google ML Kit text-recognition model that is bundled inside the app; on iPhone it uses Apple’s Vision framework. Both run offline. Images and recognised text are never sent to Docsave, Google, Apple or any other service.',
        'Recognised details are stored only inside your encrypted vault, together with the scan, and are not added to any system search index.',
      ],
    },
    {
      heading: 'No automatic cloud uploads or backups',
      body: [
        'Docsave never uploads documents. On Android, release builds of Docsave do not even request the Internet permission, so the operating system blocks all network access. Docsave’s data is excluded from iCloud, Google and computer backups and from device-to-device transfers.',
      ],
    },
    {
      heading: 'No account registration',
      body: ['Docsave does not ask for your name, email address, phone number or any account details.'],
    },
    {
      heading: 'No sharing with third parties',
      body: [
        'Docsave does not share any document or personal data with third parties. Docsave contains no advertising, no advertising identifiers, no analytics and no third-party tracking SDKs.',
      ],
    },
    {
      heading: 'Diagnostics',
      body: [
        'Diagnostics sharing is turned off by default. If you turn it on, Docsave can generate a short technical report (app version, operating system version, device security check results and the number of stored documents). The report never contains document names or contents and is only sent if you choose to share it yourself via your device’s share menu.',
      ],
    },
    {
      heading: 'How device permissions are used',
      body: [
        'Camera — only to scan the documents you choose to add, including reading boarding-pass barcodes. While you scan, small preview images are analysed in memory to detect the document; every temporary camera file is deleted immediately and the final image is encrypted before it is saved.',
        'Photos / files — only the specific items you pick are read, encrypted and stored. Temporary copies created by the system picker are deleted.',
        'Face ID / fingerprint — handled entirely by your operating system. Docsave never receives your biometric data; it only learns whether authentication succeeded.',
        'Notifications — optional local reminders scheduled on your device. They never contain document names, numbers or contents. No push token is created and nothing is sent to a server.',
      ],
    },
    {
      heading: 'Security limitations',
      body: [
        'No mobile app can fully protect data on a device that is rooted, jailbroken, infected with malware or otherwise compromised. Docsave warns you when it detects signs of such a device, but detection is not guaranteed.',
        'Anyone who knows your PIN or can pass your biometric check can open your vault.',
      ],
    },
    {
      heading: 'Your privacy rights',
      body: [
        'Because the publisher does not process your personal data, there is no data held by us to access, correct, export or delete. You remain in full control: you can view, rename and delete documents at any time, delete all documents, or permanently destroy the vault from Settings. Uninstalling the app also removes the vault.',
        `Depending on where you live, data-protection laws may give you additional rights. Questions: ${CONTACT}`,
      ],
    },
    {
      heading: 'Children',
      body: ['Docsave is not directed at children under the age required by your local law to consent to digital services.'],
    },
    {
      heading: 'Changes to this policy',
      body: ['If this policy changes, the app will show the new version and ask you to review it.'],
    },
  ],
};
