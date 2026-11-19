import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, type } from '../theme/theme';
import { useVault } from '../vault/VaultContext';
import { Button, Notice, PulseShield } from './ui';

export function IntegrityWarning() {
  const { integrity, acknowledgeIntegrity, settings } = useVault();
  return (
    <View style={styles.overlay}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, alignItems: 'center' }}>
          <PulseShield tone="warn" size={84} />
          <Text style={[type.h1, { textAlign: 'center', marginTop: spacing.lg }]}>Device security warning</Text>
          <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.md }]}>
            Docsave detected signs that this device may be rooted, jailbroken or running instrumentation tools.
          </Text>
          <View style={{ alignSelf: 'stretch', marginTop: spacing.xl }}>
            <Notice tone="warning" title="What this means">
              On a compromised device, other apps or malware may be able to bypass the operating system's
              protections, read the app's memory while a document is open, or capture your PIN. No mobile app can
              guarantee protection on a compromised device.
            </Notice>
            <Notice tone="info" title="Detected indicators">
              <Text style={type.caption}>{integrity.reasons.join('\n') || 'unspecified'}</Text>
            </Notice>
            {settings.blockOnCompromisedDevice ? (
              <Notice tone="danger" title="Unlocking is blocked">
                Your security settings prevent the vault from being unlocked on this device.
              </Notice>
            ) : null}
          </View>
        </ScrollView>
        <View style={{ padding: spacing.xl }}>
          <Button title="I understand the risks" variant="secondary" onPress={acknowledgeIntegrity} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, zIndex: 999, elevation: 999 },
});
