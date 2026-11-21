import React, { useState } from 'react';
import { Header, Notice, Screen, SettingRow, SettingsGroup, haptic } from '../../../src/components/ui';
import { useI18n } from '../../../src/i18n';
import { readPrefs, writePrefs, type ThemePref } from '../../../src/prefs';
import { scheme } from '../../../src/theme/theme';

const OPTIONS: { value: ThemePref; title: string; subtitle: string; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline' }[] = [
  { value: 'system', title: 'System', subtitle: 'Follow the phone’s light or dark mode', icon: 'phone-portrait-outline' },
  { value: 'light', title: 'Light', subtitle: 'Light background', icon: 'sunny-outline' },
  { value: 'dark', title: 'Dark', subtitle: 'Dark background', icon: 'moon-outline' },
];

export default function AppearanceSettings() {
  const { t } = useI18n();
  const [pref, setPref] = useState<ThemePref>(readPrefs().theme ?? 'system');
  const wouldBe = pref === 'system' ? null : pref;
  const pending = wouldBe !== null && wouldBe !== scheme;

  return (
    <Screen>
      <Header title={t('Appearance')} />
      <SettingsGroup>
        {OPTIONS.map((o) => (
          <SettingRow
            key={o.value}
            icon={o.icon}
            title={t(o.title)}
            subtitle={t(o.subtitle)}
            toggle={pref === o.value}
            onToggle={() => {
              haptic.tap();
              setPref(o.value);
              writePrefs({ theme: o.value });
            }}
          />
        ))}
      </SettingsGroup>
      {pending || pref === 'system' ? (
        <Notice tone="info">{t('The new appearance is applied the next time you open Docsave.')}</Notice>
      ) : null}
    </Screen>
  );
}
