import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FadeIn, Header, Screen, SectionTitle, type IconName } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme/theme';
import { BUILT_IN_CATEGORIES, ESSENTIAL_TYPES, findDocTypeAny, type CategoryDef, type DocTypeDef } from '../../src/vault/categories';
import { useVault } from '../../src/vault/VaultContext';
import { useI18n } from '../../src/i18n';

/** Step 1 of adding a document: choose what it is. Scanning starts right after. */
export default function ChooseDocumentType() {
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const { index } = useVault();
  const { t: tr, forward } = useI18n();

  // Custom folders have no predefined types: go straight to scanning.
  useEffect(() => {
    if (categoryId && index.customCategories.some((c) => c.id === categoryId)) {
      router.replace({ pathname: '/scan', params: { type: 'custom', categoryId } });
    }
  }, [categoryId]);

  const groups = useMemo(() => {
    const essential = new Set<string>(ESSENTIAL_TYPES);
    const important: CategoryDef = {
      id: 'essential',
      name: 'Most important IDs',
      icon: 'star-outline',
      color: '#34D399',
      description: '',
      builtIn: true,
      types: ESSENTIAL_TYPES.map((t) => findDocTypeAny(t)!.type),
    };
    const rest = BUILT_IN_CATEGORIES.map((c) => ({ ...c, types: c.types.filter((t) => !essential.has(t.id)) })).filter(
      (c) => c.types.length,
    );
    const list = [important, ...rest];
    const i = list.findIndex((c) => c.id === categoryId);
    if (i > 0) list.unshift(...list.splice(i, 1));
    return list;
  }, [categoryId]);

  const open = (t: DocTypeDef) => router.push({ pathname: '/scan', params: { type: t.id } });

  return (
    <Screen>
      <Header title={tr('Add document')} subtitle={tr('Choose what you want to save')} />
      <Text style={[type.bodySecondary, { marginBottom: spacing.md }]}>
        {tr('Pick a type and the camera opens with the right guide. Docsave captures it automatically and reads the details on this device.')}
      </Text>
      {/* Documents that already exist as a file or photo */}
      <Pressable
        onPress={() => router.push('/import')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.banner, pressed && { backgroundColor: colors.surfacePressed }]}
      >
        <Ionicons name="folder-open-outline" size={22} color={colors.primaryBright} />
        <View style={{ flex: 1, marginStart: spacing.md }}>
          <Text style={type.h3}>{tr('Already have it as a file or photo?')}</Text>
          <Text style={[type.caption, { marginTop: 2 }]}>{tr('Import PDFs, scans and photos of documents')}</Text>
        </View>
        <Ionicons name={forward} size={18} color={colors.textMuted} />
      </Pressable>

      {groups.map((cat, gi) => (
        <View key={cat.id}>
          <SectionTitle>{tr(cat.name)}</SectionTitle>
          <View style={styles.grid}>
            {cat.types.map((t, i) => (
              <FadeIn key={t.id} delay={gi * 60 + i * 30} style={styles.cell}>
                <Pressable
                  onPress={() => open(t)}
                  accessibilityRole="button"
                  accessibilityLabel={`${tr(t.label)}. ${tr(t.hint)}`}
                  style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfacePressed, transform: [{ scale: 0.98 }] }]}
                >
                  <View style={[styles.icon, { backgroundColor: cat.color + '1F' }]}>
                    <Ionicons name={t.icon as IconName} size={24} color={cat.color} />
                  </View>
                  <Text style={[type.h3, { marginTop: spacing.md }]} numberOfLines={2}>
                    {tr(t.label)}
                  </Text>
                  <Text style={[type.caption, { marginTop: 4 }]} numberOfLines={2} ellipsizeMode="tail">
                    {tr(t.hint)}
                  </Text>
                  {t.slots.length > 1 ? (
                    <View style={[styles.sides, { marginTop: 'auto' }]}>
                      <Ionicons name="swap-horizontal" size={11} color={colors.textSecondary} />
                      <Text style={[type.caption, { marginStart: 4, fontSize: 11 }]}>{t.slots.map((s) => tr(s)).join(' + ')}</Text>
                    </View>
                  ) : null}
                </Pressable>
              </FadeIn>
            ))}
          </View>
        </View>
      ))}

    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { width: '50%', padding: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    // Every tile has the same size, whatever its text.
    height: 176,
    overflow: 'hidden',
  },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sides: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
});
