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
      <Text style={[type.h2, { textAlign: 'center' }]}>Your important documents, always with you — and only with you.</Text>
      <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.md }]}>
        Docsave keeps your passport, ID cards, driving licence, work and student IDs, travel tickets, certificates,
        loyalty cards and coupons in one private place on your phone. Scan a document and Docsave reads the important
        details for you — name, number, dates — right on your device.
      </Text>
      <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.md }]}>
        Everything is encrypted with AES-256 before it is saved and opens only with your PIN, face or fingerprint. There
        is no account, no cloud and no tracking: your documents never leave this phone, and nobody else — not even us —
        can open them.
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
