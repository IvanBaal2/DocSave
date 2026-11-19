import React from 'react';
import { LegalView } from '../../src/components/LegalView';
import { Header, Screen } from '../../src/components/ui';
import { PRIVACY } from '../../src/content/legal';

/** Read-only during setup; also available any time in Settings. */
export default function Privacy() {
  return (
    <Screen>
      <Header title={PRIVACY.title} />
      <LegalView doc={PRIVACY} />
    </Screen>
  );
}
