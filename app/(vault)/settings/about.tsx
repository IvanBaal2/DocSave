import Constants from 'expo-constants';
import React from 'react';
import { Text, View } from 'react-native';
import { Card, Header, Logo, Screen, SectionTitle } from '../../../src/components/ui';
import { colors, spacing, type } from '../../../src/theme/theme';


const SPECS: [string, string][] = [
  ['Document encryption', 'AES-256-GCM (authenticated)'],
  ['Per-file keys', 'HKDF-SHA256 from the vault key'],
  ['PIN protection', 'scrypt (N=2¹⁵, r=8, p=1) + AES-GCM key wrap'],
  ['Key storage', 'Apple Keychain / Android Keystore, this-device-only'],
  ['Biometrics', 'OS-enforced (Face ID / BiometricPrompt)'],
  ['Randomness', 'Platform CSPRNG'],
  ['Storage', 'Private app sandbox, excluded from backups'],
  ['Network', 'None. No servers, no analytics, no ads'],
];

const LIBS = [
  '@noble/ciphers & @noble/hashes — audited cryptography',
  'expo-secure-store — Keychain / Keystore',
  'expo-local-authentication — biometrics',
  'pdf.js (Mozilla) — offline PDF rendering, bundled in the app',
];

export default function About() {
  return (
    <Screen>
      <Header title="About Docsave" />
      <View style={{ alignItems: 'center', marginVertical: spacing.xl }}>
        <Logo size={52} tagline />
        <Text style={[type.caption, { marginTop: spacing.md }]}>
          Version {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </View>
      <Text style={[type.bodySecondary, { textAlign: 'center' }]}>
        Docsave is a private document vault. Your documents are encrypted on this device and never leave it. There is
        no account and no cloud — and therefore no way for anyone else to access, or recover, your vault.
      </Text>

      <SectionTitle>Security architecture</SectionTitle>
      <Card>
        {SPECS.map(([k, v], i) => (
          <View
            key={k}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 10,
              borderBottomWidth: i < SPECS.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={[type.bodySecondary, { flex: 1 }]}>{k}</Text>
            <Text style={[type.body, { flex: 1.3, textAlign: 'right', fontSize: 14 }]}>{v}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>Open-source components</SectionTitle>
      <Card>
        {LIBS.map((l) => (
          <Text key={l} style={[type.bodySecondary, { marginBottom: 6 }]}>
            • {l}
          </Text>
        ))}
      </Card>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
        Your Documents. Your Device. Your Privacy.
      </Text>
    </Screen>
  );
}
