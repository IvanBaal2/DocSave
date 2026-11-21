import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { Card, Header, Screen, SectionTitle, type IconName } from '../../../src/components/ui';
import { useI18n } from '../../../src/i18n';
import { colors, spacing, type } from '../../../src/theme/theme';
import { autoLockLabel } from '../../../src/utils/format';
import { useVault } from '../../../src/vault/VaultContext';

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

/** Security status at a glance, then how the protection works. */
export default function Protection() {
  const { t } = useI18n();
  const vault = useVault();
  const { settings, integrity, biometrics } = vault;
  const mode = vault.meta?.unlockMode ?? 'pin';

  const status: { ok: boolean; label: string; value: string }[] = [
    { ok: true, label: t('Encryption'), value: 'AES-256-GCM' },
    {
      ok: true,
      label: t('Unlock'),
      value:
        mode === 'pin'
          ? t('PIN only')
          : mode === 'pin_and_bio'
            ? t('Two-factor')
            : biometrics.face
              ? t('Face, fingerprint, PIN')
              : t('Fingerprint, PIN'),
    },
    { ok: settings.autoLockSeconds <= 60, label: t('Automatic lock'), value: autoLockLabel(settings.autoLockSeconds) },
    { ok: settings.hideSensitivePreviews, label: t('Screen privacy'), value: settings.hideSensitivePreviews ? t('On') : t('Off') },
    {
      ok: !integrity.compromised,
      label: t('Device check'),
      value: integrity.compromised ? t('Signs of root / jailbreak detected') : t('No compromise detected'),
    },
  ];

  return (
    <Screen>
      <Header title={t('Security status')} />
      <Card>
        {status.map((s, i) => (
          <View
            key={s.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 10,
              borderBottomWidth: i < status.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
            accessible
            accessibilityLabel={`${s.label}: ${s.value}`}
          >
            <Ionicons
              name={s.ok ? 'checkmark-circle' : 'alert-circle'}
              size={20}
              color={s.ok ? colors.primaryBright : colors.warning}
            />
            <Text style={[type.bodySecondary, { flex: 1, marginStart: spacing.md }]}>{s.label}</Text>
            <Text style={[type.body, { fontSize: 14, maxWidth: '55%' }]}>{s.value}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>{t('How Docsave protects you')}</SectionTitle>
      {POINTS.map((p) => (
        <Card key={p.title} style={{ flexDirection: 'row', marginBottom: spacing.md }}>
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
          <View style={{ flex: 1, marginStart: spacing.lg }}>
            <Text style={type.h3}>{t(p.title)}</Text>
            <Text style={[type.bodySecondary, { marginTop: 4 }]}>{t(p.body)}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
