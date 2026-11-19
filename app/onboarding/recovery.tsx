import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { CheckRow } from '../../src/components/Checkbox';
import { Button, Header, Notice, Screen, StepDots } from '../../src/components/ui';
import { colors, spacing, type } from '../../src/theme/theme';
import { ONBOARDING_STEPS, useOnboarding } from './_layout';

const LOSS_CASES = [
  'You forget your PIN',
  'Your phone is lost, stolen, reset or replaced',
  'You uninstall Docsave',
  'You enable two-factor unlock and your Face ID / fingerprints change',
  'You enable auto-erase and the wrong PIN is entered 10 times',
];

export default function Recovery() {
  const router = useRouter();
  const ob = useOnboarding();
  return (
    <Screen
      footer={
        <Button
          title="Continue"
          disabled={!ob.recoveryAcknowledged}
          onPress={() => router.push('/onboarding/terms')}
        />
      }
    >
      <Header title="No recovery — by design" right={<StepDots step={3} total={ONBOARDING_STEPS} />} />
      <Notice tone="danger" title="Important — please read" icon="alert-circle">
        Docsave has no account, no recovery email and no recovery server. Nobody — not even the makers of Docsave —
        can open your vault or reset your PIN.
      </Notice>
      <Text style={[type.h3, { marginTop: spacing.xl, marginBottom: spacing.md }]}>
        Your documents are permanently lost if:
      </Text>
      {LOSS_CASES.map((c) => (
        <View key={c} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md }}>
          <Ionicons name="close-circle" size={20} color={colors.danger} style={{ marginTop: 1 }} />
          <Text style={[type.body, { marginLeft: spacing.md, flex: 1 }]}>{c}</Text>
        </View>
      ))}
      <Notice tone="info" title="Keep your originals">
        Docsave is a secure copy, not a replacement. Keep original documents and any copies you may need elsewhere.
      </Notice>
      <CheckRow
        checked={ob.recoveryAcknowledged}
        onChange={(v) => ob.set({ recoveryAcknowledged: v })}
        label="I understand that if I lose access to my vault, my documents cannot be recovered."
      />
    </Screen>
  );
}
