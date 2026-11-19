import React from 'react';
import { LegalView } from '../../src/components/LegalView';
import { Header, Screen } from '../../src/components/ui';
import { TERMS } from '../../src/content/legal';

/** Read-only during setup; also available any time in Settings. */
export default function Terms() {
  return (
    <Screen>
      <Header title={TERMS.title} />
      <LegalView doc={TERMS} />
    </Screen>
  );
}
