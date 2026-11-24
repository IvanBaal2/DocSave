import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Chip, Header, Notice, Screen, SectionTitle, SettingRow, SettingsGroup } from '../../../src/components/ui';
import { useI18n } from '../../../src/i18n';
import { useReauth } from '../../../src/security/ReauthProvider';
import { colors, radius, spacing, type, fonts } from '../../../src/theme/theme';
import type { UnlockMode } from '../../../src/vault/types';
import { useVault, type BiometricInfo } from '../../../src/vault/VaultContext';
import { autoLockLabel } from '../../../src/utils/format';

const AUTO_LOCK = [0, 30, 60, 300];

type Section = 'unlock' | 'autolock' | 'access' | 'integrity';
const TITLES: Record<Section, string> = {
  unlock: 'Unlock methods',
  autolock: 'Automatic lock',
  access: 'Document protection',
  integrity: 'Device security check',
};

type MethodState = 'ready' | 'off' | 'not-set-up' | 'unsupported';

function methodState(supported: boolean, bio: BiometricInfo, on: boolean): MethodState {
  if (!supported || !bio.available) return 'unsupported';
  if (!bio.enrolled) return 'not-set-up';
  return on ? 'ready' : 'off';
}

/** One priority line: 1 face, 2 fingerprint, 3 PIN. */
function PriorityRow({
  rank,
  icon,
  title,
  state,
}: {
  rank: number;
  icon: 'scan-outline' | 'finger-print-outline' | 'keypad-outline';
  title: string;
  state: MethodState | 'backup';
}) {
  const { t } = useI18n();
  const meta = {
    ready: { label: t('Active'), color: colors.primaryBright, bg: colors.primarySoft },
    backup: { label: t('Always available'), color: colors.primaryBright, bg: colors.primarySoft },
    off: { label: t('Off'), color: colors.textSecondary, bg: colors.surfaceAlt },
    'not-set-up': { label: t('Not set up on this phone'), color: colors.warning, bg: colors.warningSoft },
    unsupported: { label: t('Not available on this phone'), color: colors.textMuted, bg: colors.surfaceAlt },
  }[state];
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}
      accessible
      accessibilityLabel={`${rank}. ${title}: ${meta.label}`}
    >
      {/* The number is the order Docsave tries the methods in. */}
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 2,
          borderColor: state === 'ready' || state === 'backup' ? colors.primary : colors.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[type.h3, { fontSize: 14, color: state === 'ready' || state === 'backup' ? colors.primaryBright : colors.textMuted }]}>{rank}</Text>
      </View>
      <Ionicons name={icon} size={18} color={colors.textMuted} style={{ marginStart: spacing.md }} />
      <Text style={[type.h3, { flex: 1, marginHorizontal: spacing.md, fontFamily: fonts.medium }]}>{title}</Text>
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: meta.bg }}>
        <Text style={[type.caption, { color: meta.color, fontFamily: fonts.semibold }]}>{meta.label}</Text>
      </View>
    </View>
  );
}

/** One page per setting: the settings list links to a single section. */
export default function SecuritySettings() {
  const { section } = useLocalSearchParams<{ section?: Section }>();
  const show = (x: Section) => !section || section === x;
  const router = useRouter();
  const vault = useVault();
  const { t } = useI18n();
  const { requestPin, authenticate } = useReauth();
  const { settings, biometrics, integrity } = vault;
  const mode = vault.meta?.unlockMode ?? 'pin';
  const [busy, setBusy] = useState(false);
  const bioOn = mode !== 'pin';
  const bioLabel = t(biometrics.label);

  async function changeMode(next: UnlockMode) {
    if (next === mode || busy) return;
    const apply = async () => {
      const pin = await requestPin(t('Enter your PIN to change how the vault unlocks'));
      if (!pin) return;
      setBusy(true);
      try {
        await vault.setUnlockMode(next, pin, true);
      } catch (e) {
        Alert.alert(t('Not changed'), (e as Error)?.message || t('{method} confirmation was cancelled or failed.', { method: bioLabel }));
      } finally {
        setBusy(false);
      }
    };
    apply();
  }

  async function toggleWipe(on: boolean) {
    if (!on) {
      if (await authenticate(t('Confirm to change a security setting'), { pinOnly: true })) {
        vault.updateSettings({ wipeAfterFailedAttempts: false });
      }
      return;
    }
    Alert.alert(
      t('Erase after 10 failed attempts?'),
      t(
        'If someone enters a wrong PIN 10 times in a row, the vault and all documents will be permanently destroyed. This protects against guessing, but also means a mistake can erase everything.',
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Enable'),
          style: 'destructive',
          onPress: async () => {
            if (await authenticate(t('Confirm to change a security setting'), { pinOnly: true })) {
              vault.updateSettings({ wipeAfterFailedAttempts: true });
            }
          },
        },
      ],
    );
  }

  async function setAutoLock(s: number) {
    if (s === settings.autoLockSeconds) return;
    // A longer delay weakens protection: confirm it is really you.
    if (s > settings.autoLockSeconds && !(await authenticate(t('Confirm to change a security setting')))) return;
    vault.updateSettings({ autoLockSeconds: s });
  }

  const bioUsable = biometrics.available;

  return (
    <Screen>
      <Header title={t(section ? TITLES[section] : 'Security')} />

      {show('unlock') ? (
        <>
          <Text style={[type.bodySecondary, { marginBottom: spacing.md }]}>
            {t(
              'Docsave asks your phone for face recognition first. If it is not set up or does not succeed, your phone offers fingerprint. Your PIN always works as the backup.',
            )}
          </Text>
          <SettingsGroup>
            <PriorityRow rank={1} icon="scan-outline" title={t('Face recognition')} state={methodState(biometrics.face, biometrics, bioOn)} />
            <PriorityRow
              rank={2}
              icon="finger-print-outline"
              title={t('Fingerprint')}
              state={methodState(biometrics.fingerprint, biometrics, bioOn)}
            />
            <PriorityRow rank={3} icon="keypad-outline" title={t('PIN code')} state="backup" />
          </SettingsGroup>

          <SectionTitle>{t('Settings')}</SectionTitle>
          <SettingsGroup>
            <SettingRow
              icon={biometrics.face ? 'scan-outline' : 'finger-print-outline'}
              title={t('Use face and fingerprint')}
              subtitle={
                !bioUsable
                  ? t('Not available on this phone')
                  : !biometrics.enrolled
                    ? t('Set up a face or fingerprint in your phone settings first')
                    : t('Unlock without typing your PIN')
              }
              toggle={bioOn}
              onToggle={(on) => changeMode(on ? 'pin_or_bio' : 'pin')}
              disabled={busy || (!bioUsable && !bioOn)}
            />
            <SettingRow icon="keypad-outline" title={t('Change PIN')} onPress={() => router.push('/settings/change-pin')} />
          </SettingsGroup>

          {mode !== 'pin' && vault.meta?.bioBinding === 'device-check' ? (
            <Notice tone="info" title={t('Device check')}>
              {t(
                'This phone does not allow keys that are locked to biometrics in secure hardware, so Docsave releases a Keystore-encrypted key after the system check succeeds. For the strongest protection use the PIN only.',
              )}
            </Notice>
          ) : mode !== 'pin' ? (
            <Notice tone="success" title={t('Hardware-bound biometric key')}>
              {t('The vault key can only be released by the secure hardware after your face or fingerprint is verified.')}
            </Notice>
          ) : null}
          <Text style={[type.caption, { marginTop: spacing.md }]}>
            {t('Your face and fingerprint are checked by the phone. Docsave never receives or stores them.')}
          </Text>
        </>
      ) : null}

      {show('autolock') ? (
        <>
          {!section ? <SectionTitle>{t('Automatic lock')}</SectionTitle> : null}
          <Text style={[type.bodySecondary, { marginBottom: spacing.md }]}>
            {t('Lock the vault and erase the key from memory after Docsave has been in the background for:')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {AUTO_LOCK.map((s) => (
              <Chip key={s} label={autoLockLabel(s, true)} selected={settings.autoLockSeconds === s} onPress={() => setAutoLock(s)} />
            ))}
          </View>
          <Text style={[type.caption, { marginTop: spacing.xs }]}>
            {t('The vault also locks after 5 minutes without interaction while open.')}
          </Text>
        </>
      ) : null}

      {show('access') ? (
        <>
          {!section ? <SectionTitle>{t('Document protection')}</SectionTitle> : null}
          <SettingsGroup>
            <SettingRow
              icon="finger-print-outline"
              title={t('Re-authenticate to view documents')}
              subtitle={t('Confirm it is you before a document opens (60-second grace period)')}
              toggle={settings.reauthForDocuments}
              onToggle={async (v) => {
                if (!v && !(await authenticate(t('Confirm to change a security setting'), { pinOnly: true }))) return;
                vault.updateSettings({ reauthForDocuments: v });
              }}
            />
            <SettingRow
              icon="flame-outline"
              title={t('Erase after 10 failed PINs')}
              subtitle={t('Permanently destroy the vault after 10 wrong PINs in a row')}
              toggle={settings.wipeAfterFailedAttempts}
              onToggle={toggleWipe}
            />
          </SettingsGroup>
          <Notice tone="info" title={t('Protection against guessing')}>
            {t(
              'After 5 wrong PINs, Docsave enforces an increasing waiting period (30 s, 1 min, 2 min … up to 1 hour). Each PIN check also runs 600,000 rounds of PBKDF2 key stretching.',
            )}
          </Notice>
        </>
      ) : null}

      {show('integrity') ? (
        <>
          {!section ? <SectionTitle>{t('Device security check')}</SectionTitle> : null}
          <Notice
            tone={integrity.compromised ? 'warning' : 'success'}
            title={integrity.compromised ? t('Signs of root / jailbreak detected') : t('No compromise detected')}
          >
            {integrity.compromised
              ? t('Docsave will not unlock on this device.')
              : t(
                  'No signs of rooting, jailbreaking or instrumentation were found. Detection is heuristic: no mobile app can guarantee protection on a compromised device.',
                )}
          </Notice>
        </>
      ) : null}
    </Screen>
  );
}
