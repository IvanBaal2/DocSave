# Permission inventory

## Android (production / preview builds, `DOCSAVE_PROFILE=production`)

| Permission | Why | When requested |
|---|---|---|
| `CAMERA` | Scan documents and barcodes | First scan |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | Face or fingerprint unlock through the OS | Normal (no prompt) |
| `POST_NOTIFICATIONS` (Android 13+) | Optional local expiry reminders | When the user enables reminders |
| Library-added normal permissions (for example `VIBRATE`, `RECEIVE_BOOT_COMPLETED` for scheduled reminders, `SCHEDULE_EXACT_ALARM` if present) | Local notifications | Normal |

Explicitly **blocked**: `INTERNET`, `ACCESS_NETWORK_STATE`, `RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`, location, `SYSTEM_ALERT_WINDOW`, `AD_ID`. Photos and files are read through the system pickers, which need no storage permission.

Verify the final merged manifest of each release with `node scripts/verify-apk.mjs <apk>`.

## iOS (Info.plist)

| Key | Text purpose |
|---|---|
| `NSCameraUsageDescription` | Scan documents |
| `NSPhotoLibraryUsageDescription` | Import a photo the user selects |
| `NSFaceIDUsageDescription` | Unlock with Face ID |

No microphone, location, contacts or tracking (`NSPrivacyTracking: false`).
