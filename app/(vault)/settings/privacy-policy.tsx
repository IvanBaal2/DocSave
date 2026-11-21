import React from 'react';
import { useI18n } from '../../../src/i18n';
import { LegalView } from '../../../src/components/LegalView';
import { Header, Screen } from '../../../src/components/ui';
import { PRIVACY } from '../../../src/content/legal';

export default function PrivacyPolicyScreen() {
  const { t } = useI18n();
  return (
    <Screen>
      <Header title={t(PRIVACY.title)} />
      <LegalView doc={PRIVACY} />
    </Screen>
  );
}
