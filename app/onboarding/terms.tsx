import React from 'react';
import { useI18n } from '../../src/i18n';
import { LegalView } from '../../src/components/LegalView';
import { Header, Screen } from '../../src/components/ui';
import { TERMS } from '../../src/content/legal';

/** Read-only during setup; also available any time in Settings. */
export default function Terms() {
  const { t } = useI18n();
  return (
    <Screen>
      <Header title={t(TERMS.title)} />
      <LegalView doc={TERMS} />
    </Screen>
  );
}
