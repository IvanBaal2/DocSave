# Licence inventory

Source: [sbom.cdx.json](sbom.cdx.json), generated with `npm sbom --omit=dev --sbom-format=cyclonedx` on 19 November 2026 (377 npm components). The npm dependency tree includes build-time tools (Metro, Babel, Expo CLI). Only part of it ships in the app bundle.

## npm licences (all components identified, none unknown)

| Licence | Count | Notes |
|---|---|---|
| MIT | 349 | React, React Native, Expo modules, @noble/ciphers, @noble/hashes, base64-js, … |
| ISC | 8 | |
| BSD-3-Clause | 4 | source-map, @react-native/debugger-frontend (dev tooling) |
| Apache-2.0 | 3 | **pdfjs-dist 6.5.438** (shipped as an app asset), xcode, exponential-backoff (build) |
| BSD-2-Clause | 2 | terser, regjsparser (build) |
| MPL-2.0 | 2 | lightningcss (build only; not shipped) |
| Unlicense | 2 | big-integer, stream-buffers (build) |
| MIT OR CC0-1.0 | 2 | type-fest |
| MIT OR Apache-2.0 | 1 | fb-dotslash |
| BSD-3-Clause OR GPL-2.0 | 1 | node-forge (build tooling; used under BSD-3-Clause) |
| 0BSD, Python-2.0, BlueOak-1.0.0 | 1 each | build tooling |

No copyleft licence affects the shipped app: GPL is only one option for node-forge, which is build tooling, and MPL-2.0 is limited to build-time lightningcss.

## Native / non-npm components (not in the npm SBOM)

| Component | Licence / terms | Action |
|---|---|---|
| Google ML Kit Text Recognition `com.google.mlkit:text-recognition:16.0.1` (Android, bundled model) | Google ML Kit Terms of Service / Google APIs Terms | **Owner must review and accept** the ML Kit terms |
| AndroidX ExifInterface, Conscrypt-backed platform crypto | Apache-2.0 / platform | Attribution in an in-app licences screen is recommended |
| Apple CryptoKit, CommonCrypto, Vision | Apple SDK licence | — |
| Ionicons (via @expo/vector-icons) | MIT | — |

## Assets

| Asset | Origin | Status |
|---|---|---|
| `assets/brand/*`, app icon, splash | Logo supplied by the owner | **Owner must confirm ownership or a licence** |
| `assets/pdfjs/*` | Copied from pdfjs-dist at install time | Apache-2.0. Keep the NOTICE. |

## Obligations to fulfil before release
- Apache-2.0 (pdf.js) and MIT/BSD components require attribution. Add an "Open-source licences" page (in-app or on the website) that reproduces the licence texts. **Not yet implemented.**
