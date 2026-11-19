/**
 * Docsave Expo configuration.
 *
 * DOCSAVE_PROFILE=production (set by the eas.json "preview" and "production"
 * profiles) produces a hardened build: on Android the INTERNET permission is
 * removed from the manifest, so the operating system itself prevents Docsave
 * from opening any network connection. Development builds keep INTERNET so the
 * dev client can load the JavaScript bundle from Metro.
 */
const IS_PRODUCTION = process.env.DOCSAVE_PROFILE === 'production';

// Permanent store identifier (Android applicationId / iOS bundle identifier).
// NEVER change this after the first store upload.
const BUNDLE_ID = process.env.DOCSAVE_BUNDLE_ID || 'ivanbaal2.docsave.com';

const FACE_ID_TEXT = 'Docsave uses Face ID to unlock your encrypted document vault.';
const CAMERA_TEXT =
  'Docsave uses the camera to scan documents. Photos are encrypted immediately and never leave your device.';
const PHOTOS_TEXT =
  'Docsave lets you choose photos of documents to encrypt and store in your private vault.';

const blockedPermissions = [
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'com.google.android.gms.permission.AD_ID',
];
if (IS_PRODUCTION) {
  blockedPermissions.push('android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE');
}

module.exports = {
  expo: {
    name: 'Docsave',
    slug: 'docsave',
    version: '1.1.0',
    scheme: 'docsave',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    backgroundColor: '#05080F',
    icon: './assets/icon.png',
    ios: {
      bundleIdentifier: BUNDLE_ID,
      // iPhone-only listing (iPads still run it in compatibility mode), so no
      // iPad screenshots are required for App Store review.
      supportsTablet: false,
      // Every file Docsave writes is unreadable while the device is locked.
      entitlements: {
        'com.apple.developer.default-data-protection': 'NSFileProtectionComplete',
      },
      infoPlist: {
        NSFaceIDUsageDescription: FACE_ID_TEXT,
        NSCameraUsageDescription: CAMERA_TEXT,
        NSPhotoLibraryUsageDescription: PHOTOS_TEXT,
        UIFileSharingEnabled: false,
        LSSupportsOpeningDocumentsInPlace: false,
        // Docsave only uses standard, OS-provided-class encryption (AES-GCM) to
        // protect the user's own data, which is exempt from US export
        // documentation. Confirm this declaration before submitting.
        ITSAppUsesNonExemptEncryption: false,
      },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyCollectedDataTypes: [],
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['C617.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
            NSPrivacyAccessedAPITypeReasons: ['E174.1'],
          },
        ],
      },
    },
    android: {
      package: BUNDLE_ID,
      allowBackup: false,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#05080F',
      },
      permissions: [
        'android.permission.CAMERA',
        'android.permission.USE_BIOMETRIC',
        'android.permission.USE_FINGERPRINT',
        'android.permission.POST_NOTIFICATIONS',
      ],
      blockedPermissions,
    },
    plugins: [
      'expo-router',
      // Launch screen: Docsave artwork on the app's dark background.
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#05080F',
          android: { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: '#05080F' },
          ios: { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: '#05080F' },
        },
      ],
      // The development launcher is only included in development builds.
      ...(IS_PRODUCTION ? [] : ['expo-dev-client']),
      ['expo-secure-store', { faceIDPermission: FACE_ID_TEXT, configureAndroidBackup: false }],
      ['expo-local-authentication', { faceIDPermission: FACE_ID_TEXT }],
      [
        'expo-camera',
        { cameraPermission: CAMERA_TEXT, microphonePermission: false, recordAudioAndroid: false },
      ],
      [
        'expo-image-picker',
        { photosPermission: PHOTOS_TEXT, cameraPermission: CAMERA_TEXT, microphonePermission: false },
      ],
      // Listed before expo-notifications so its entitlement mod runs after it
      // and removes the remote-push entitlement (local reminders only).
      './plugins/withNoRemotePush',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#10B981',
          enableBackgroundRemoteNotifications: false,
        },
      ],
      '@react-native-community/datetimepicker',
      [
        'expo-build-properties',
        {
          android: { minSdkVersion: 26 },
          ios: { deploymentTarget: '16.4' },
        },
      ],
      './plugins/withAndroidNoBackup',
    ],
    experiments: { typedRoutes: false },
    owner: 'ivanbaal2',
    extra: {
      production: IS_PRODUCTION,
      eas: { projectId: '0e4678ea-56be-42f8-aa3c-78edb968f630' },
    },
  },
};
