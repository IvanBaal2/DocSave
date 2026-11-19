import { Ionicons } from '@expo/vector-icons';

import React from 'react';
import { Text, View } from 'react-native';
import { Card, FadeIn, Header, Screen, type IconName } from '../../../src/components/ui';
import { colors, spacing, type } from '../../../src/theme/theme';


const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'key',
    title: 'Encrypted before saving',
    body: 'Each document is encrypted with AES-256-GCM in memory before anything touches storage. Tampering is detected automatically.',
  },
  {
    icon: 'hardware-chip',
    title: 'Key protected by secure hardware',
    body: 'A random 256-bit key is generated on this phone and locked inside the Apple Keychain / Android Keystore, protected by your PIN and biometrics.',
  },
  {
    icon: 'cloud-offline',
    title: 'Never leaves your device',
    body: 'No cloud, no sync, no servers. Docsave is excluded from iCloud, Google and computer backups.',
  },
  {
    icon: 'eye-off',
    title: 'Private by design',
    body: 'No thumbnails, no previews in the app switcher, no document details in notifications, no ads and no trackers.',
  },
];

export default function Protection() {

  return (
    <Screen>
      <Header title="How Docsave protects you" />
      <Text style={[type.bodySecondary, { marginBottom: spacing.lg }]}>
        Docsave works like a safe that only exists on this phone.
      </Text>
      {POINTS.map((p, i) => (
        <FadeIn key={p.title} delay={i * 90}>
          <Card style={{ flexDirection: 'row', marginBottom: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={p.icon} size={20} color={colors.primaryBright} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.lg }}>
              <Text style={type.h3}>{p.title}</Text>
              <Text style={[type.bodySecondary, { marginTop: 4 }]}>{p.body}</Text>
            </View>
          </Card>
        </FadeIn>
      ))}
    </Screen>
  );
}
