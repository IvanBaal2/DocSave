import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Chip, Header, Notice, Screen, SectionTitle, SettingRow, SettingsGroup } from '../../../src/components/ui';
import { useReauth } from '../../../src/security/ReauthProvider';
import { spacing, type } from '../../../src/theme/theme';
import type { UnlockMode } from '../../../src/vault/types';
import { useVault } from '../../../src/vault/VaultContext';
import { autoLockLabel } from '../../../src/utils/format';

const AUTO_LOCK = [0, 30, 60, 300];

export default function SecuritySettings() {
  const vault = useVault();
  const { requestPin, authenticate } = useReauth();
  const { settings, biometrics, integrity } = vault;
  const mode = vault.meta?.unlockMode ?? 'pin';
  const [busy, setBusy] = useState(false);

  async function changeMode(next: UnlockMode) {
    if (next === mode || busy) return;
    const apply = async () => {
      const pin = await requestPin('Enter your PIN to change how the vault unlocks');
      if (!pin) return;
      setBusy(true);
      try {
        await vault.setUnlockMode(next, pin);
      } catch (e) {
        Alert.alert('Not changed', (e as Error)?.message || `${biometrics.label} confirmation was cancelled or failed.`);
      } finally {
        setBusy(false);
      }
    };
    if (next === 'pin_and_bio') {
      Alert.alert(
        'Enable two-factor unlock?',
        `Both ${biometrics.label} and your PIN will be required. The key becomes bound to your currently enrolled biometrics: if you add, remove or reset ${biometrics.label}, the vault can never be opened again — there is no recovery.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'I understand, enable', style: 'destructive', onPress: apply },
        ],
      );
    } else {
      apply();
    }
  }

  async function toggleWipe(on: boolean) {
    if (!on) return vault.updateSettings({ wipeAfterFailedAttempts: false });
    Alert.alert(
      'Erase after 10 failed attempts?',
      'If someone enters a wrong PIN 10 times in a row, the vault and all documents will be permanently destroyed. This protects against guessing, but also means a mistake can erase everything.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          style: 'destructive',
          onPress: async () => {
            if (await authenticate('Confirm to enable auto-erase', { pinOnly: true })) {
              vault.updateSettings({ wipeAfterFailedAttempts: true });
            }
          },
        },
      ],
    );
  }

  const bioUsable = biometrics.available && biometrics.enrolled;

  return (
    <Screen>
      <Header title="Security settings" />

      <SectionTitle>Unlock method</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="keypad-outline"
          title="PIN only"
          subtitle="Biometrics are not used"
          toggle={mode === 'pin'}
          onToggle={() => changeMode('pin')}
          disabled={busy}
        />
        <SettingRow
          icon={biometrics.icon}
          title={`${biometrics.label} or PIN`}
          subtitle="Fast unlock; PIN as fallback"
          toggle={mode === 'pin_or_bio'}
          onToggle={() => changeMode('pin_or_bio')}
          disabled={busy || !bioUsable}
        />
        <SettingRow
          icon="shield-half-outline"
          title={`Two-factor (${biometrics.label} + PIN)`}
          subtitle="Both required every time — maximum security"
          toggle={mode === 'pin_and_bio'}
          onToggle={() => changeMode('pin_and_bio')}
          disabled={busy || !bioUsable}
        />
      </SettingsGroup>
      {mode === 'pin_or_bio' && vault.meta?.bioBinding === 'device-check' ? (
        <Notice tone="info" title={`${biometrics.label}: device check`}>
          {`This phone does not allow keys that are locked to ${biometrics.label.toLowerCase()} in secure hardware, so Docsave releases a Keystore-encrypted key after the system ${biometrics.label.toLowerCase()} check succeeds. For the strongest protection choose "PIN only".`}
        </Notice>
      ) : mode !== 'pin' ? (
        <Notice tone="success" title="Hardware-bound biometric key">
          {`The vault key can only be released by the secure hardware after ${biometrics.label.toLowerCase()} succeeds.`}
        </Notice>
      ) : null}
      {!bioUsable ? (
        <Notice tone="info">{`${biometrics.label} is not set up on this device. Enrol it in your device settings to use it with Docsave.`}</Notice>
      ) : null}

      <SectionTitle>Automatic lock</SectionTitle>
      <Text style={[type.bodySecondary, { marginBottom: spacing.md }]}>
        Lock the vault and erase the key from memory after Docsave has been in the background for:
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {AUTO_LOCK.map((s) => (
          <Chip
            key={s}
            label={autoLockLabel(s).replace('After ', '')}
            selected={settings.autoLockSeconds === s}
            onPress={() => vault.updateSettings({ autoLockSeconds: s })}
          />
        ))}
      </View>
      <Text style={[type.caption, { marginTop: spacing.xs }]}>
        The vault also locks after 5 minutes without interaction while open.
      </Text>

      <SectionTitle>Document access</SectionTitle>
      <SettingsGroup>
        <SettingRow
          icon="finger-print-outline"
          title="Re-authenticate to view documents"
          subtitle={`Ask for ${bioUsable && mode !== 'pin' ? biometrics.label : 'PIN'} before decrypting a document (60-second grace period)`}
          toggle={settings.reauthForDocuments}
          onToggle={async (v) => {
            if (!v && !(await authenticate('Confirm to turn off document re-authentication', { pinOnly: true }))) return;
            vault.updateSettings({ reauthForDocuments: v });
          }}
        />
        <SettingRow
          icon="flame-outline"
          title="Erase after 10 failed PINs"
          subtitle="Permanently destroy the vault after 10 wrong PINs in a row"
          toggle={settings.wipeAfterFailedAttempts}
          onToggle={toggleWipe}
        />
      </SettingsGroup>
      <Notice tone="info" title="Brute-force protection">
        After 5 wrong PINs, Docsave enforces an increasing waiting period (30 s, 1 min, 2 min … up to 1 hour). Each
        PIN check also runs the memory-hard scrypt function.
      </Notice>

      <SectionTitle>Device integrity</SectionTitle>
      <Notice
        tone={integrity.compromised ? 'warning' : 'success'}
        title={integrity.compromised ? 'Signs of root / jailbreak detected' : 'No compromise detected'}
      >
        {integrity.compromised
          ? `Indicators: ${integrity.reasons.join(', ')}. Use Docsave on a non-modified device for full protection.`
          : 'No signs of rooting, jailbreaking or instrumentation were found. Detection is heuristic: no mobile app can guarantee protection on a compromised device.'}
      </Notice>
      <SettingsGroup>
        <SettingRow
          icon="ban-outline"
          title="Block on compromised devices"
          subtitle="Refuse to unlock when root / jailbreak indicators are found"
          toggle={settings.blockOnCompromisedDevice}
          onToggle={(v) => vault.updateSettings({ blockOnCompromisedDevice: v })}
        />
      </SettingsGroup>
    </Screen>
  );
}
