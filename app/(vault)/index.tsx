import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DocumentCard, iconForDocument } from '../../src/components/DocumentCard';
import { EmptyState, FadeIn, IconButton, SectionTitle, type IconName } from '../../src/components/ui';
import { colors, gradients, radius, shadow, spacing, type } from '../../src/theme/theme';
import { ESSENTIAL_TYPES, findCategory, findDocTypeAny } from '../../src/vault/categories';
import { useVault } from '../../src/vault/VaultContext';
import { daysUntil, displayName } from '../../src/utils/format';
import { useI18n } from '../../src/i18n';

export default function Dashboard() {
  const router = useRouter();
  const vault = useVault();
  const { t, forward, direction } = useI18n();
  const { documents, customCategories } = vault.index;
  const mine = useMemo(() => [...documents].sort((a, b) => a.name.localeCompare(b.name)), [documents]);
  const expiring = useMemo(
    () =>
      documents.filter((d) => {
        const n = daysUntil(d.expiryDate);
        return d.categoryId !== 'travel' && n != null && n <= 90;
      }),
    [documents],
  );
  const mode = vault.meta?.unlockMode ?? 'pin';
  const compromised = vault.integrity.compromised;
  const unlockLabel = mode === 'pin' ? 'PIN' : t(vault.biometrics.label);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, direction }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.md, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Brand + 2. compact security indicator */}
        <View style={styles.topRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ flex: 1 }}>
              <Text style={[type.h1, { fontSize: 22 }]}>
                Doc<Text style={{ color: colors.primaryBright }}>save</Text>
              </Text>
              <Pressable
                onPress={() => router.push('/settings/security')}
                accessibilityRole="button"
                accessibilityLabel={compromised ? t('Security warning. Open security settings') : t('Vault protected with {method}. Open security settings', { method: unlockLabel })}
                style={[styles.statusPill, compromised && { borderColor: colors.warning + '66', backgroundColor: colors.warningSoft }]}
              >
                <View style={[styles.dot, { backgroundColor: compromised ? colors.warning : colors.primaryBright }]} />
                <Text style={[type.caption, { color: compromised ? colors.warning : colors.primaryBright, fontWeight: '600' }]}>
                  {compromised ? t('Device at risk') : t('Protected')}
                </Text>
                <Text style={[type.caption, { marginStart: 6 }]} numberOfLines={1}>
                  · AES-256 · {unlockLabel}
                </Text>
              </Pressable>
            </View>
          </View>
          <IconButton icon="settings-outline" accessibilityLabel={t('Settings')} onPress={() => router.push('/settings')} />
        </View>

        {/* Search box at the top: always in the same place */}
        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="search"
          accessibilityLabel={t('Search documents')}
          style={({ pressed }) => [styles.searchBox, pressed && { backgroundColor: colors.surfacePressed }]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text style={[type.body, { color: colors.textMuted, marginStart: spacing.sm, flex: 1 }]} numberOfLines={1}>
            {t('Search documents')}
          </Text>
        </Pressable>

        {/* 3. Main action */}
        <FadeIn>
          <Pressable
            onPress={() => router.push('/add')}
            accessibilityRole="button"
            accessibilityLabel={t('Add Document')}
            style={({ pressed }) => [styles.hero, pressed && { transform: [{ scale: 0.985 }] }]}
          >
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.heroIcon}>
              <Ionicons name="add" size={30} color="#03140D" />
            </View>
            <View style={{ flex: 1, marginStart: spacing.lg }}>
              <Text style={[type.h1, { color: '#03140D', fontSize: 21 }]}>{t('Add Document')}</Text>
              <Text style={{ color: '#063D2B', fontSize: 13, marginTop: 2, lineHeight: 18 }}>
                {t('Scan a passport, ID or ticket. Read automatically and encrypted on this device.')}
              </Text>
            </View>
            <Ionicons name="scan" size={26} color="#03140D" />
          </Pressable>
        </FadeIn>

        {expiring.length ? (
          <Pressable
            onPress={() => router.push({ pathname: '/document/[id]', params: { id: expiring[0].id } })}
            style={styles.alert}
            accessibilityRole="button"
          >
            <Ionicons name="alarm-outline" size={18} color={colors.warning} />
            <Text style={[type.bodySecondary, { flex: 1, marginStart: spacing.sm, color: colors.text }]}>
              {expiring.length === 1 ? t('“{name}” expires soon', { name: displayName(expiring[0].name) }) : t('{count} documents expire within 90 days', { count: expiring.length })}
            </Text>
            <Ionicons name={forward} size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {/* 4. Essential IDs: one tap to open, or to scan if not saved yet */}
        <SectionTitle>{t('My IDs')}</SectionTitle>
        <View style={styles.idGrid}>
          {ESSENTIAL_TYPES.map((typeId, i) => {
            const def = findDocTypeAny(typeId)!;
            const saved = documents.filter((d) => d.docType === typeId).sort((a, b) => b.updatedAt - a.updatedAt);
            const doc = saved[0];
            const days = daysUntil(doc?.expiryDate);
            return (
              <FadeIn key={typeId} delay={60 + i * 40} style={styles.idCell}>
                <Pressable
                  // Always adds a new one (e.g. a family member's ID); saved ones are under My Documents.
                  onPress={() => router.push({ pathname: '/scan', params: { type: typeId } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('Add')} ${t(def.type.label)}${saved.length ? `, ${t('{count} saved', { count: saved.length })}` : ''}`}
                  style={({ pressed }) => [
                    styles.idTile,
                    doc && { borderColor: colors.primaryBorder },
                    pressed && { backgroundColor: colors.surfacePressed, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <View style={[styles.catIcon, { backgroundColor: doc ? colors.primarySoft : colors.surfaceAlt }]}>
                    <Ionicons name={def.type.icon as IconName} size={22} color={doc ? colors.primaryBright : colors.textSecondary} />
                  </View>
                  <Text style={[type.h3, { marginTop: spacing.sm, fontSize: 14 }]} numberOfLines={1}>
                    {t(def.type.label)}
                  </Text>
                  {doc ? (
                    <Text
                      style={[type.caption, { marginTop: 2, color: days != null && days <= 90 ? colors.warning : colors.primaryBright }]}
                      numberOfLines={1}
                    >
                      {days != null && days < 0 ? `${t('{count} saved', { count: saved.length })} · ${t('one expired')}` : days != null && days <= 90 ? `${t('{count} saved', { count: saved.length })} · ${t('expires in {days} days', { days })}` : `${t('{count} saved', { count: saved.length })} · ${t('+ add another')}`}
                    </Text>
                  ) : (
                    <Text style={[type.caption, { marginTop: 2 }]}>{t('+ Add')}</Text>
                  )}
                </Pressable>
              </FadeIn>
            );
          })}
        </View>

        {documents.length > 0 && !vault.settings.protectionInfoSeen ? (
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primaryBright} />
            <View style={{ flex: 1, marginStart: spacing.md }}>
              <Text style={type.h3}>{t('Saved and encrypted on this phone')}</Text>
              <Text style={[type.caption, { marginTop: 2 }]}>
                {t('Your documents are never uploaded or backed up. Important: Docsave cannot recover them if you forget your PIN, uninstall the app or lose this phone. Keep your original documents.')}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                <Pressable onPress={() => router.push('/settings/protection')} accessibilityRole="button" hitSlop={8}>
                  <Text style={[type.caption, { color: colors.primaryBright, fontWeight: '600' }]}>{t('How it works')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => vault.updateSettings({ protectionInfoSeen: true })}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={{ marginStart: spacing.xl }}
                >
                  <Text style={[type.caption, { color: colors.textSecondary }]}>{t('Got it')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* 5. My documents */}
        <SectionTitle
          action={
            documents.length > 8 ? (
              <Pressable onPress={() => router.push('/search')} accessibilityRole="button" hitSlop={8}>
                <Text style={[type.caption, { color: colors.primaryBright }]}>{t('See all {count}', { count: documents.length })}</Text>
              </Pressable>
            ) : undefined
          }
        >
          {t('My Documents')}
        </SectionTitle>
        {documents.length === 0 ? (
          <EmptyState
            icon="shield-outline"
            title={t('Your vault is empty')}
            body={t('Tap Add Document to scan your passport, ID card or tickets. Everything is encrypted before it is saved.')}
          />
        ) : (
          mine.slice(0, 8).map((d) => (
            <DocumentCard
              key={d.id}
              doc={d}
              custom={customCategories}
              onPress={() => router.push({ pathname: '/document/[id]', params: { id: d.id } })}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    maxWidth: '100%',
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginEnd: 6 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    ...shadow,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning + '44',
  },
  idGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  idCell: { width: '50%', padding: spacing.xs },
  idTile: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  catIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recent: {
    width: 140,
    marginEnd: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
});
