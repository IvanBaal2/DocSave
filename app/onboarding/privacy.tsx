import { useRouter } from 'expo-router';
import React from 'react';
import { CheckRow } from '../../src/components/Checkbox';
import { LegalView } from '../../src/components/LegalView';
import { Button, Header, Screen, StepDots } from '../../src/components/ui';
import { PRIVACY } from '../../src/content/legal';
import { ONBOARDING_STEPS, useOnboarding } from './_layout';

export default function Privacy() {
  const router = useRouter();
  const ob = useOnboarding();
  return (
    <Screen
      footer={<Button title="Continue" disabled={!ob.privacyAccepted} onPress={() => router.push('/onboarding/pin')} />}
    >
      <Header title={PRIVACY.title} right={<StepDots step={4} total={ONBOARDING_STEPS} />} />
      <LegalView doc={PRIVACY} />
      <CheckRow
        checked={ob.privacyAccepted}
        onChange={(v) => ob.set({ privacyAccepted: v })}
        label="I have read the Privacy Policy."
      />
    </Screen>
  );
}
