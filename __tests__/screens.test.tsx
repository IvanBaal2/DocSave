/**
 * Smoke tests: every screen renders with realistic data and the native
 * modules mocked. Catches render crashes (undefined values, bad props,
 * missing imports) before a device build.
 */
import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: () => true,
};
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => {
  const R = require('react');
  const Stack = ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children);
  Stack.Screen = () => null;
  Stack.Protected = ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children);
  return {
    useRouter: () => mockRouter,
    router: mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, []),
    Stack,
  };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

let mockCameraPermission: { granted: boolean; status: string; canAskAgain: boolean } = {
  granted: true,
  status: 'granted',
  canAskAgain: true,
};
const mockRequestCamera = jest.fn(async () => mockCameraPermission);
const mockGetCamera = jest.fn(async () => mockCameraPermission);
jest.mock('expo-camera', () => {
  const R = require('react');
  const { View } = require('react-native');
  const CameraView = R.forwardRef((props: object, ref: unknown) => R.createElement(View, { ...props, ref, testID: 'camera' }));
  return {
    CameraView,
    useCameraPermissions: () => [mockCameraPermission, mockRequestCamera, mockGetCamera],
  };
});

jest.mock('react-native-webview', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { WebView: (p: object) => R.createElement(View, { ...p, testID: 'webview' }) };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const R = require('react');
  const { View } = require('react-native');
  const Picker = (p: object) => R.createElement(View, p);
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));

jest.mock('expo-asset', () => {
  class Asset {
    localUri = 'file:///x';
    uri = 'file:///x';
    static fromModule() {
      return new Asset();
    }
    async downloadAsync() {
      return this;
    }
  }
  return { Asset };
});

jest.mock('@expo/vector-icons', () => {
  const R = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => R.createElement(Text, null, '');
  return { Ionicons: Icon };
});

jest.mock('expo-file-system', () => ({
  File: class {
    async text() {
      return '';
    }
    open() {
      // every picked test file starts like a PDF
      return { readBytes: () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), close: () => {} };
    }
  },
  Directory: class {},
  Paths: {},
}));

const mockPickedFiles: { current: unknown[] } = { current: [] };
const mockPickedPhotos: { current: unknown[] } = { current: [] };
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: mockPickedFiles.current })),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: mockPickedPhotos.current })),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

jest.mock('../modules/docsave-security', () => ({
  isNativeSecurityAvailable: true,
  NativeSecurity: null,
  checkIntegrity: () => ({ compromised: false, emulator: false, reasons: [] }),
  excludeFromBackup: () => true,
  recognizeText: jest.fn(async () => ({ width: 1, height: 1, lines: [] })),
  recognizeBest: jest.fn(async () => ({ width: 1, height: 1, lines: [], rotation: 0 })),
  cropJpeg: jest.fn(async (b: string) => b),
  rotateJpeg: jest.fn(async (b: string) => b),
  warpJpeg: jest.fn(async (b: string) => b),
  sha256File: jest.fn(async (path: string) => `hash-${path}`),
  readLastCrash: () => null,
  clearLastCrash: () => {},
  nativeErrorCode: () => undefined,
  sortLines: (l: unknown[]) => l,
}));

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const documents = [
  {
    id: 'd1',
    name: 'Passport Ivan Lorence Bongon',
    categoryId: 'identity',
    docType: 'passport',
    expiryDate: '2031-09-23',
    description: 'Passport · Ivan Lorence Bongon · expires 23 Sep 2031',
    fields: [
      { key: 'fullName', label: 'Full name', value: 'Ivan Lorence Bongon', status: 'recognized' },
      { key: 'expiryDate', label: 'Expiry date', value: '2031-09-23', status: 'recognized' },
    ],
    pages: [{ id: 'p1', label: 'Photo page', mimeType: 'image/png', size: 1000 }],
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000,
  },
  {
    id: 'd2',
    name: 'Driving Licence — IVAN',
    categoryId: 'identity',
    docType: 'driving_licence',
    expiryDate: '2020-01-01',
    pages: [
      { id: 'p2', label: 'Front', mimeType: 'image/jpeg', size: 2000 },
      { id: 'p3', label: 'Back', mimeType: 'image/jpeg', size: 2000 },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'd3',
    name: 'Contract',
    categoryId: 'personal',
    docType: 'contract',
    pages: [{ id: 'p4', label: 'File', mimeType: 'application/pdf', size: 5000 }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const mockVault = {
  status: 'unlocked',
  meta: { version: 1, vaultId: 'v', createdAt: 0, unlockMode: 'pin_or_bio', pinLength: 6, bioBinding: 'device-check' },
  settings: {
    autoLockSeconds: 30,
    hideSensitivePreviews: true,
    reauthForDocuments: false,
    wipeAfterFailedAttempts: false,
    blockOnCompromisedDevice: true,
    notificationsEnabled: false,
    expiryReminders: true,
    identityReminders: true,
    travelReminders: true,
    reminderLeadDays: 30,
    notificationDetail: 'generic',
    diagnosticsEnabled: false,
    acceptedTermsVersion: '1.1',
    acceptedPrivacyVersion: '1.1',
    protectionInfoSeen: false,
  },
  index: { version: 1, documents, customCategories: [] },
  integrity: { compromised: false, emulator: false, reasons: [] },
  integrityAcknowledged: true,
  acknowledgeIntegrity: jest.fn(),
  biometrics: { available: true, enrolled: true, label: 'Face or fingerprint', icon: 'finger-print-outline', face: true, fingerprint: true },
  attempts: { failed: 0, lockedUntil: 0 },
  twoFactorPending: false,
  initializeVault: jest.fn(async () => ({})),
  enterVault: jest.fn(),
  unlockWithPin: jest.fn(async () => ({ ok: true })),
  unlockWithBiometrics: jest.fn(async () => ({ ok: false, error: '' })),
  lock: jest.fn(),
  addDocument: jest.fn(),
  updateDocument: jest.fn(),
  deleteDocument: jest.fn(),
  readPage: jest.fn(async () => PNG_1PX),
  addCategory: jest.fn(),
  deleteCategory: jest.fn(),
  deleteAllDocuments: jest.fn(),
  destroyVault: jest.fn(),
  verifyPin: jest.fn(async () => true),
  changePin: jest.fn(async () => true),
  setUnlockMode: jest.fn(async () => true),
  updateSettings: jest.fn(),
  runExternal: (fn: () => Promise<unknown>) => fn(),
  markAuthenticated: jest.fn(),
  recentlyAuthenticated: () => true,
  touch: jest.fn(),
};

jest.mock('../src/vault/VaultContext', () => ({
  useVault: () => mockVault,
  VaultProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../src/security/ReauthProvider', () => ({
  useReauth: () => ({ authenticate: async () => true, requestPin: async () => '480317' }),
  ReauthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockOnboarding = {
  recoveryAcknowledged: true,
  termsAccepted: true,
  privacyAccepted: true,
  pin: '480317',
  unlockMode: 'pin_or_bio',
  set: jest.fn(),
};
jest.mock('../app/onboarding/_layout', () => ({
  __esModule: true,
  default: () => null,
  useOnboarding: () => mockOnboarding,
  ONBOARDING_STEPS: 3,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
async function renderScreen(load: () => { default: React.ComponentType }, params: Record<string, string> = {}) {
  mockParams = params;
  const Screen = load().default;
  await act(async () => {
    render(<Screen />);
  });
  // let effects and promises settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}

beforeEach(() => jest.clearAllMocks());

// ── Screens ──────────────────────────────────────────────────────────────────
describe('setup screens', () => {
  test('welcome', async () => {
    await renderScreen(() => require('../app/onboarding/index'));
    expect(screen.getByText('Get started')).toBeTruthy();
    expect(screen.getByText(/I accept the Terms & Conditions/)).toBeTruthy();
    expect(screen.getByText(/lost access means my documents cannot be recovered/)).toBeTruthy();
  });
  test('face / fingerprint step', async () => {
    await renderScreen(() => require('../app/onboarding/biometrics'));
    expect(screen.getByText('Use face or fingerprint')).toBeTruthy();
  });
  test('backup PIN', async () => {
    await renderScreen(() => require('../app/onboarding/pin'));
    expect(screen.getByText('Backup PIN')).toBeTruthy();
  });
  test('terms and privacy', async () => {
    await renderScreen(() => require('../app/onboarding/terms'));
    expect(screen.getByText('Terms & Conditions')).toBeTruthy();
    await renderScreen(() => require('../app/onboarding/privacy'));
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
  });
  test('finish creates the vault and confirms', async () => {
    await renderScreen(() => require('../app/onboarding/finish'));
    expect(mockVault.initializeVault).toHaveBeenCalled();
    expect(await screen.findByText('Your vault is ready')).toBeTruthy();
  });
});

describe('lock screen', () => {
  test('renders keypad and auto-prompts biometrics', async () => {
    await renderScreen(() => require('../app/lock'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(screen.getByText('Your vault is locked')).toBeTruthy();
    expect(mockVault.unlockWithBiometrics).toHaveBeenCalled();
    // face / fingerprint first; the PIN pad only when asked for
    expect(screen.queryByLabelText('Digit 1')).toBeNull();
    const { fireEvent } = require('@testing-library/react-native');
    await act(async () => {
      fireEvent.press(screen.getByText('Enter PIN instead'));
    });
    expect(screen.getByLabelText('Digit 1')).toBeTruthy();
  });
});

describe('vault screens', () => {
  test('dashboard', async () => {
    await renderScreen(() => require('../app/(vault)/index'));
    expect(screen.getByText('Scan a document')).toBeTruthy();
    expect(screen.getByText('All documents')).toBeTruthy();
    // identity documents shown as wallet cards
    expect(screen.getByLabelText('Passport, Ivan Lorence Bongon')).toBeTruthy();
    // search box at the top of the home screen
    expect(screen.getByRole('search')).toBeTruthy();
    expect(screen.getByText('Passport Ivan Lorence Bongon')).toBeTruthy();
    // old names lose the dash
    expect(screen.getAllByText('Driving Licence IVAN').length).toBeGreaterThan(0);
  });
  test('document type picker', async () => {
    await renderScreen(() => require('../app/(vault)/add'));
    expect(screen.getByText('Most important IDs')).toBeTruthy();
    expect(screen.getByText('Loyalty Card')).toBeTruthy();
  });
  test('search', async () => {
    await renderScreen(() => require('../app/(vault)/search'));
    expect(screen.getByText('Passport Ivan Lorence Bongon')).toBeTruthy();
  });
  test('scan screen opens the guided camera', async () => {
    await renderScreen(() => require('../app/(vault)/scan'), { type: 'national_id' });
    expect(screen.getByTestId('camera')).toBeTruthy();
  });
  test('document viewer: image page', async () => {
    await renderScreen(() => require('../app/(vault)/document/[id]'), { id: 'd1' });
    expect(mockVault.readPage).toHaveBeenCalledWith('p1');
    expect(screen.getByText('Rotate')).toBeTruthy();
  });
  test('document viewer: two-sided document', async () => {
    await renderScreen(() => require('../app/(vault)/document/[id]'), { id: 'd2' });
    expect(screen.getByText('Front')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
  });
  test('document viewer: PDF', async () => {
    await renderScreen(() => require('../app/(vault)/document/[id]'), { id: 'd3' });
    expect(mockVault.readPage).toHaveBeenCalledWith('p4');
  });
  test('document viewer: missing document', async () => {
    await renderScreen(() => require('../app/(vault)/document/[id]'), { id: 'nope' });
    expect(screen.getByText('This document no longer exists.')).toBeTruthy();
  });
});

describe('settings screens', () => {
  const pages: [string, string, Record<string, string>][] = [
    ['../app/(vault)/settings/index', 'Settings', {}],
    ['../app/(vault)/settings/security', 'Unlock methods', { section: 'unlock' }],
    ['../app/(vault)/settings/security', 'Automatic lock', { section: 'autolock' }],
    ['../app/(vault)/settings/security', 'Document protection', { section: 'access' }],
    ['../app/(vault)/settings/change-pin', 'Change PIN', {}],
    ['../app/(vault)/settings/privacy', 'Privacy settings', {}],
    ['../app/(vault)/settings/rights', 'Your privacy rights', {}],
    ['../app/(vault)/settings/notifications', 'Reminders', {}],
    ['../app/(vault)/settings/language', 'Language', {}],
    ['../app/onboarding/language', 'Language', {}],
    ['../app/(vault)/settings/about', 'About Docsave', {}],
    ['../app/(vault)/settings/terms', 'Terms & Conditions', {}],
    ['../app/(vault)/settings/privacy-policy', 'Privacy Policy', {}],
    ['../app/(vault)/settings/protection', 'Security status', {}],
    ['../app/(vault)/settings/danger', 'Destroy vault', { action: 'destroy' }],
  ];
  test.each(pages)('%s', async (path, title, params) => {
    await renderScreen(() => require(path), params);
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  });
});

describe('unlock order and settings', () => {
  test('unlock methods list face first, fingerprint second, PIN as backup', async () => {
    await renderScreen(() => require('../app/(vault)/settings/security'), { section: 'unlock' });
    const face = screen.getByLabelText(/^1. Face recognition/);
    const finger = screen.getByLabelText(/^2. Fingerprint/);
    const pin = screen.getByLabelText(/^3. PIN code: Always available/);
    expect(face && finger && pin).toBeTruthy();
    expect(screen.getByText('Change PIN')).toBeTruthy();
  });
  test('settings home shows each function once', async () => {
    await renderScreen(() => require('../app/(vault)/settings/index'));
    for (const title of ['Unlock methods', 'Change PIN', 'Automatic lock', 'Language', 'Reminders', 'Privacy Policy', 'Delete all documents']) {
      expect(screen.getAllByText(title)).toHaveLength(1);
    }
  });
  test('settings switch to Arabic immediately', async () => {
    const { setLanguage } = require('../src/i18n');
    await renderScreen(() => require('../app/(vault)/settings/index'));
    await act(async () => setLanguage('ar'));
    expect(screen.getByText('الإعدادات')).toBeTruthy();
    await act(async () => setLanguage('en'));
    expect(screen.getByText('Settings')).toBeTruthy();
  });
});

describe('import files', () => {
  test('several files: each previewed, sorted and saved; unsupported ones explained', async () => {
    mockPickedFiles.current = [
      { uri: 'file:///cache/Boarding pass MAD-LHR.pdf', name: 'Boarding pass MAD-LHR.pdf', mimeType: 'application/pdf', size: 2048 },
      { uri: 'file:///cache/notes 2026.pdf', name: 'notes 2026.pdf', mimeType: 'application/pdf', size: 4096 },
      { uri: 'file:///cache/setup.exe', name: 'setup.exe', mimeType: 'application/octet-stream', size: 4096 },
    ];
    mockVault.addDocument.mockClear();
    await renderScreen(() => require('../app/(vault)/import'), { source: 'files' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByDisplayValue('Boarding pass MAD-LHR')).toBeTruthy();
    expect(screen.getByText('Recognised as Boarding Pass')).toBeTruthy();
    expect(screen.getByDisplayValue('notes 2026')).toBeTruthy();
    expect(screen.getByText(/Not recognised. Saved under Other Documents/)).toBeTruthy();
    expect(screen.getByText(/This file type is not supported/)).toBeTruthy();
    const { fireEvent } = require('@testing-library/react-native');
    await act(async () => {
      fireEvent.press(screen.getByText('Encrypt & save 2 documents'));
    });
    expect(mockVault.addDocument).toHaveBeenCalledTimes(2);
    expect(mockVault.addDocument.mock.calls[0][0]).toMatchObject({ name: 'Boarding pass MAD-LHR', categoryId: 'travel', docType: 'boarding_pass' });
    expect(mockVault.addDocument.mock.calls[1][0]).toMatchObject({ categoryId: 'other', docType: 'pdf' });
    expect(mockVault.addDocument.mock.calls[0][0].pages[0]).toMatchObject({ fileName: 'Boarding pass MAD-LHR.pdf', sha256: expect.any(String) });
  });
  test('an ordinary photo is accepted as a general photo', async () => {
    mockPickedPhotos.current = [{ uri: 'file:///cache/IMG_1.jpg', fileName: 'IMG_1.jpg', mimeType: 'image/png', base64: PNG_1PX }];
    await renderScreen(() => require('../app/(vault)/import'), { source: 'photos' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByText(/Saved as a general photo/)).toBeTruthy();
    expect(screen.getAllByText('General Photos').length).toBeGreaterThan(0);
  });
});

describe('removed features', () => {
  test('no Appearance and no two-factor option in settings', async () => {
    await renderScreen(() => require('../app/(vault)/settings/index'));
    expect(screen.queryByText('Appearance')).toBeNull();
    await renderScreen(() => require('../app/(vault)/settings/security'), { section: 'unlock' });
    expect(screen.queryByText(/two-factor/i)).toBeNull();
  });
  test('home has camera and import entry points', async () => {
    await renderScreen(() => require('../app/(vault)/index'));
    expect(screen.getByText('Scan a document')).toBeTruthy();
    expect(screen.getByText('Import files')).toBeTruthy();
  });
});

describe('camera permission', () => {
  const { Linking } = require('react-native');
  const { fireEvent } = require('@testing-library/react-native');
  function Harness({ onImport }: { onImport: () => void }) {
    const { CameraPermissionScreen, useCameraAccess } = require('../src/components/CameraPermission');
    const a = useCameraAccess();
    if (a.access === 'granted') {
      const { Text } = require('react-native');
      return <Text>camera open</Text>;
    }
    return (
      <CameraPermissionScreen
        access={a.access}
        requesting={a.requesting}
        onRequest={a.request}
        onOpenSettings={a.openSettings}
        onImport={onImport}
        onCancel={() => {}}
      />
    );
  }
  async function mount(perm: typeof mockCameraPermission, onImport = jest.fn()) {
    mockCameraPermission = perm;
    await act(async () => {
      render(<Harness onImport={onImport} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    return onImport;
  }
  const { AppState } = require('react-native');
  let listeners: ((s: string) => void)[] = [];
  let appStateSpy: jest.SpyInstance;
  const emit = async (s: string) => {
    await act(async () => {
      [...listeners].forEach((l) => l(s));
      await new Promise((r) => setTimeout(r, 0));
    });
  };
  beforeEach(() => {
    listeners = [];
    appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_e: unknown, cb: unknown) => {
      const fn = cb as (s: string) => void;
      listeners.push(fn);
      return { remove: () => (listeners = listeners.filter((l) => l !== fn)) };
    });
  });
  afterEach(() => appStateSpy.mockRestore());
  afterAll(() => {
    mockCameraPermission = { granted: true, status: 'granted', canAskAgain: true };
  });

  test('first use shows the system dialog once, automatically', async () => {
    await mount({ granted: false, status: 'undetermined', canAskAgain: true });
    expect(mockRequestCamera).toHaveBeenCalledTimes(1);
  });
  test('denied: explains and lets the user ask again, without asking automatically', async () => {
    await mount({ granted: false, status: 'denied', canAskAgain: true });
    expect(mockRequestCamera).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText('Allow camera'));
    });
    expect(mockRequestCamera).toHaveBeenCalledTimes(1);
    // Coming back to Docsave (e.g. from the notification shade or settings) re-checks the permission.
    mockGetCamera.mockClear();
    await emit('active');
    expect(mockGetCamera).toHaveBeenCalled();
  });
  test('blocked: Open Settings opens app settings, import and cancel available', async () => {
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const onImport = await mount({ granted: false, status: 'denied', canAskAgain: false });
    expect(screen.getByText('Camera Access Required')).toBeTruthy();
    expect(screen.getByText(/Camera permission is currently disabled/)).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
    fireEvent.press(screen.getByText('Import a File Instead'));
    expect(onImport).toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText('Open Settings'));
    });
    expect(spy).toHaveBeenCalled();
    expect(mockRequestCamera).not.toHaveBeenCalled();
    // The user enables the camera in Settings and comes back: permission is re-checked.
    mockGetCamera.mockClear();
    await emit('background');
    await emit('active');
    expect(mockGetCamera).toHaveBeenCalled();
    spy.mockRestore();
  });

});
