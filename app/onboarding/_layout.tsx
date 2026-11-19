import { Stack } from 'expo-router';
import React, { createContext, useContext, useState } from 'react';
import { colors } from '../../src/theme/theme';
import type { UnlockMode } from '../../src/vault/types';

type OnboardingState = {
  recoveryAcknowledged: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  /** Held in memory only until the vault is initialised. */
  pin: string | null;
  unlockMode: UnlockMode;
};

type Ctx = OnboardingState & { set: (patch: Partial<OnboardingState>) => void };

const OnboardingContext = createContext<Ctx | null>(null);

export function useOnboarding(): Ctx {
  const c = useContext(OnboardingContext);
  if (!c) throw new Error('useOnboarding outside onboarding');
  return c;
}

export const ONBOARDING_STEPS = 7;

export default function OnboardingLayout() {
  const [state, setState] = useState<OnboardingState>({
    recoveryAcknowledged: false,
    termsAccepted: false,
    privacyAccepted: false,
    pin: null,
    unlockMode: 'pin_or_bio',
  });
  return (
    <OnboardingContext.Provider value={{ ...state, set: (p) => setState((s) => ({ ...s, ...p })) }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />
    </OnboardingContext.Provider>
  );
}
