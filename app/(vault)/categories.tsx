import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, Header, Screen, SectionTitle, SettingRow, SettingsGroup, TextField, type IconName } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme/theme';
import { BUILT_IN_CATEGORIES, CUSTOM_CATEGORY_ICONS } from '../../src/vault/categories';
import { useVault } from '../../src/vault/VaultContext';

export default function ManageCategories() {
  const vault = useVault();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(CUSTOM_CATEGORY_ICONS[0]);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const n = name.trim();
    if (!n) return setError('Enter a folder name.');
    if (n.length > 40) return setError('Use 40 characters or fewer.');
    const exists = [...BUILT_IN_CATEGORIES, ...vault.index.customCategories].some(
      (c) => c.name.toLowerCase() === n.toLowerCase(),
    );
    if (exists) return setError('A folder with this name already exists.');
    await vault.addCategory(n, icon);
    setName('');
    setError(null);
  }

  function remove(id: string, label: string) {
    const count = vault.index.documents.filter((d) => d.categoryId === id).length;
    Alert.alert(
      `Delete "${label}"?`,
      count
        ? `${count} document${count === 1 ? '' : 's'} in this folder will be moved to Other Documents. No documents are deleted.`
        : 'This folder is empty.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete folder', style: 'destructive', onPress: () => vault.deleteCategory(id) },
      ],
    );
  }

  return (
    <Screen>
      <Header title="Folders & categories" />
      <SectionTitle>New folder</SectionTitle>
      <TextField
        label="Folder name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Car, Home, Work"
        maxLength={40}
        error={error}
      />
      <Text style={[type.overline, { marginBottom: spacing.sm }]}>Icon</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg }}>
        {CUSTOM_CATEGORY_ICONS.map((i) => (
          <Pressable
            key={i}
            onPress={() => setIcon(i)}
            accessibilityRole="radio"
            accessibilityState={{ selected: icon === i }}
            accessibilityLabel={i.replace('-outline', '')}
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.md,
              marginRight: spacing.sm,
              marginBottom: spacing.sm,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: icon === i ? colors.primary : colors.border,
              backgroundColor: icon === i ? colors.primarySoft : colors.surface,
            }}
          >
            <Ionicons name={i as IconName} size={22} color={icon === i ? colors.primaryBright : colors.textSecondary} />
          </Pressable>
        ))}
      </View>
      <Button title="Create folder" icon="add" onPress={create} />

      <SectionTitle>Your folders</SectionTitle>
      {vault.index.customCategories.length === 0 ? (
        <Text style={type.bodySecondary}>You have not created any custom folders yet.</Text>
      ) : (
        <SettingsGroup>
          {vault.index.customCategories.map((c) => (
            <SettingRow
              key={c.id}
              icon={c.icon as IconName}
              title={c.name}
              subtitle={`${vault.index.documents.filter((d) => d.categoryId === c.id).length} documents · tap to delete`}
              onPress={() => remove(c.id, c.name)}
            />
          ))}
        </SettingsGroup>
      )}

      <SectionTitle>Built-in categories</SectionTitle>
      <SettingsGroup>
        {BUILT_IN_CATEGORIES.map((c) => (
          <SettingRow key={c.id} icon={c.icon as IconName} title={c.name} subtitle={c.types.map((t) => t.label).join(', ')} />
        ))}
      </SettingsGroup>
    </Screen>
  );
}
