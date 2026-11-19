import React from 'react';
import { LegalView } from '../../../src/components/LegalView';
import { Header, Screen } from '../../../src/components/ui';
import { TERMS } from '../../../src/content/legal';

export default function TermsScreen() {
  return (
    <Screen>
      <Header title={TERMS.title} />
      <LegalView doc={TERMS} />
    </Screen>
  );
}
