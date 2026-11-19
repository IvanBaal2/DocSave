import { useRouter } from 'expo-router';
import React from 'react';
import { CheckRow } from '../../src/components/Checkbox';
import { LegalView } from '../../src/components/LegalView';
import { Button, Header, Screen, StepDots } from '../../src/components/ui';
import { TERMS } from '../../src/content/legal';
import { ONBOARDING_STEPS, useOnboarding } from './_layout';

export default function Terms() {
  const router = useRouter();
  const ob = useOnboarding();
  return (
    <Screen
      footer={
        <Button title="Accept and continue" disabled={!ob.termsAccepted} onPress={() => router.push('/onboarding/privacy')} />
      }
    >
      <Header title={TERMS.title} right={<StepDots step={4} total={ONBOARDING_STEPS} />} />
      <LegalView doc={TERMS} />
      <CheckRow
        checked={ob.termsAccepted}
        onChange={(v) => ob.set({ termsAccepted: v })}
        label="I have read and accept the Terms & Conditions."
      />
    </Screen>
  );
}
