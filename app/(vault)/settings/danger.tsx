import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Keyboard } from 'react-native';
import { CheckRow } from '../../../src/components/Checkbox';
import { Button, Header, Notice, Screen, TextField, haptic } from '../../../src/components/ui';
import { spacing } from '../../../src/theme/theme';
import { useI18n } from '../../../src/i18n';
import { useVault } from '../../../src/vault/VaultContext';

export default function DangerZone() {
  const { action } = useLocalSearchParams<{ action: 'delete-all' | 'destroy' }>();
  const router = useRouter();
  const vault = useVault();
  const { t } = useI18n();
  const [ack, setAck] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const destroy = action === 'destroy';
  const word = destroy ? 'DESTROY' : 'DELETE';
  const count = vault.index.documents.length;

  async function run() {
    setBusy(true);
    try {
      if (destroy) {
        await vault.destroyVault(); // route guard returns to first-time setup
      } else {
        await vault.deleteAllDocuments();
        haptic.success();
        router.back();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          title={destroy ? t('Permanently destroy vault') : count === 1 ? t('Delete 1 document') : t('Delete {count} documents', { count })}
          variant="danger"
          icon={destroy ? 'nuclear' : 'trash'}
          loading={busy}
          disabled={!ack || typed.trim().toUpperCase() !== word}
          onPress={run}
        />
      }
    >
      <Header title={destroy ? t('Destroy vault') : t('Delete all documents')} />
      {/* The confirmation controls sit directly under the warning, near the top, so the keyboard never covers them. */}
      <Notice tone="danger" title={t('This cannot be undone')}>
        {destroy
          ? t('The encryption keys are erased from secure hardware, then all encrypted files, settings and reminders are deleted. Docsave has no backup and no recovery, and will return to first-time setup.')
          : t('All {count} documents and their encrypted files will be deleted. Docsave has no backup and no recovery. Your PIN and settings are kept.', { count })}
      </Notice>
      <CheckRow checked={ack} onChange={setAck} label={t('I understand my documents will be permanently and irreversibly lost.')} />
      <TextField
        label={t('Type {word} to confirm', { word })}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        placeholder={word}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => Keyboard.dismiss()}
        style={{ marginTop: spacing.sm }}
      />
    </Screen>
  );
}
