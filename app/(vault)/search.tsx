import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DocumentCard } from '../../src/components/DocumentCard';
import { Chip, EmptyState, IconButton, privateInputProps } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme/theme';
import { allCategories, findCategory, findDocType } from '../../src/vault/categories';
import { useVault } from '../../src/vault/VaultContext';
import { useI18n } from '../../src/i18n';

/** Search runs entirely in memory over the decrypted index. Nothing is indexed on disk. */
export default function Search() {
  const router = useRouter();
  const { index } = useVault();
  const { t, back, direction } = useI18n();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const cats = allCategories(index.customCategories);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return index.documents
      .filter((d) => !cat || d.categoryId === cat)
      .filter((d) => {
        if (!needle) return true;
        const hay = [
          d.name,
          d.notes ?? '',
          findCategory(d.categoryId, index.customCategories)?.name ?? '',
          t(findCategory(d.categoryId, index.customCategories)?.name ?? ''),
          findDocType(d.categoryId, d.docType)?.label ?? '',
          t(findDocType(d.categoryId, d.docType)?.label ?? ''),
          ...d.pages.map((p) => p.label),
          d.description ?? '',
          ...(d.fields ?? []).map((f) => f.value),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [q, cat, index, t]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, direction }} edges={['top']}>
      <View style={styles.bar}>
        <IconButton icon={back} accessibilityLabel={t('Go back')} onPress={() => router.back()} />
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            {...privateInputProps}
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder={t('Search documents')}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            returnKeyType="search"
            style={styles.input}
            accessibilityLabel={t('Search documents')}
          />
          {q ? <Ionicons name="close-circle" size={18} color={colors.textMuted} onPress={() => setQ('')} /> : null}
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.xl }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: null as string | null, name: t('All') }, ...cats.map((c) => ({ id: c.id as string | null, name: t(c.name) }))]}
          keyExtractor={(c) => c.id ?? 'all'}
          renderItem={({ item }) => <Chip label={item.name} selected={cat === item.id} onPress={() => setCat(item.id)} />}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <DocumentCard
            doc={item}
            custom={index.customCategories}
            onPress={() => router.push({ pathname: '/document/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <EmptyState icon="search-outline" title={t('No documents found')} body={t('Try another word or category.')} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginStart: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, marginStart: spacing.sm },
});
