import React from 'react';
import { LegalView } from '../../../src/components/LegalView';
import { Header, Screen } from '../../../src/components/ui';
import { PRIVACY } from '../../../src/content/legal';

export default function PrivacyPolicyScreen() {
  return (
    <Screen>
      <Header title={PRIVACY.title} />
      <LegalView doc={PRIVACY} />
    </Screen>
  );
}
