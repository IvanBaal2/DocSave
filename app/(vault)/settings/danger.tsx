import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text } from 'react-native';
import { CheckRow } from '../../../src/components/Checkbox';
import { Button, Header, Notice, PulseShield, Screen, TextField, haptic } from '../../../src/components/ui';
import { spacing, type } from '../../../src/theme/theme';
import { useVault } from '../../../src/vault/VaultContext';

export default function DangerZone() {
  const { action } = useLocalSearchParams<{ action: 'delete-all' | 'destroy' }>();
  const router = useRouter();
  const vault = useVault();
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
          title={destroy ? 'Permanently destroy vault' : `Delete ${count} document${count === 1 ? '' : 's'}`}
          variant="danger"
          icon={destroy ? 'nuclear' : 'trash'}
          loading={busy}
          disabled={!ack || typed.trim().toUpperCase() !== word}
          onPress={run}
        />
      }
    >
      <Header title={destroy ? 'Destroy vault' : 'Delete all documents'} />
      <PulseShield tone="warn" size={64} />
      <Notice tone="danger" title="This cannot be undone">
        {destroy
          ? 'The encryption keys are erased from secure hardware (crypto-shredding), then all encrypted files, folders, settings and reminders are deleted. Docsave will return to first-time setup.'
          : `All ${count} documents and their encrypted files will be deleted. Your PIN, folders and settings are kept.`}
      </Notice>
      <Text style={[type.bodySecondary, { marginTop: spacing.md }]}>
        Docsave has no backup and no recovery. Make sure you no longer need these documents.
      </Text>
      <CheckRow checked={ack} onChange={setAck} label="I understand my documents will be permanently and irreversibly lost." />
      <TextField
        label={`Type ${word} to confirm`}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        placeholder={word}
        style={{ marginTop: spacing.lg }}
      />
    </Screen>
  );
}
