import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { DocumentCard } from '../../src/components/DocumentCard';
import { EmptyState, IconButton, type IconName } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { colors, fonts, radius, shadow, spacing, type } from '../../src/theme/theme';
import { daysUntil, displayName, formatDate } from '../../src/utils/format';
import { ESSENTIAL_TYPES, findDocTypeAny } from '../../src/vault/categories';
import type { DocumentRecord } from '../../src/vault/types';
import { useVault } from '../../src/vault/VaultContext';

/** Fine wavy lines like the security print on real documents (decoration only). */
function SecurityPrint({ color, width, height, opacity }: { color: string; width: number; height: number; opacity: number }) {
  const rows = [40, 52, 64, 76];
  const w = width;
  const seg = w / 4;
  return (
    <Svg width={w} height={height} style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {rows.map((y) => (
        <Path
          key={y}
          d={`M0 ${y} Q ${seg / 2} ${y - 30} ${seg} ${y} T ${seg * 2} ${y} T ${seg * 3} ${y} T ${seg * 4} ${y}`}
          stroke={color}
          strokeWidth={0.8}
          fill="none"
        />
      ))}
    </Svg>
  );
}

const field = (d: DocumentRecord, key: string) => d.fields?.find((f) => f.key === key)?.value?.trim();

export default function Home() {
  const router = useRouter();
  const vault = useVault();
  const { t, forward, direction } = useI18n();
  const { documents, customCategories } = vault.index;

  const list = useMemo(() => [...documents].sort((a, b) => b.updatedAt - a.updatedAt), [documents]);
  // The wallet stack: identity documents, the one expiring soonest on top.
  const ids = useMemo(
    () =>
      documents
        .filter((d) => d.categoryId === 'identity')
        .sort((a, b) => (daysUntil(a.expiryDate) ?? 1e9) - (daysUntil(b.expiryDate) ?? 1e9))
        .slice(0, 2),
    [documents],
  );
  const expiringOther = useMemo(
    () =>
      documents.filter((d) => {
        const n = daysUntil(d.expiryDate);
        return d.categoryId !== 'identity' && d.categoryId !== 'travel' && n != null && n <= 30;
      }),
    [documents],
  );

  const mode = vault.meta?.unlockMode ?? 'pin';
  const compromised = vault.integrity.compromised;
  const { biometrics } = vault;
  const lockedWith =
    mode === 'pin' ? t('Locked with your PIN') : biometrics.face ? t('Locked with your face') : t('Locked with your fingerprint');

  function chooseImport() {
    Alert.alert(t('Import'), t('Where is the document?'), [
      { text: t('Files (PDF, images…)'), onPress: () => router.push({ pathname: '/import', params: { source: 'files' } }) },
      { text: t('Photo library'), onPress: () => router.push({ pathname: '/import', params: { source: 'photos' } }) },
      { text: t('Cancel'), style: 'cancel' },
    ]);
  }

  const open = (d: DocumentRecord) => router.push({ pathname: '/document/[id]', params: { id: d.id } });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, direction }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: spacing.md, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={[type.h1, { fontSize: 24 }]}>Docsave</Text>
            <Pressable
              onPress={() => router.push('/settings/protection')}
              accessibilityRole="button"
              accessibilityLabel={compromised ? t('Security warning. Open security settings') : lockedWith}
              style={styles.status}
              hitSlop={6}
            >
              <Ionicons name={compromised ? 'warning' : 'shield-checkmark'} size={14} color={compromised ? colors.warning : colors.primary} />
              <Text style={[type.caption, { marginStart: 6, color: compromised ? colors.warning : '#9FD9C4' }]}>
                {compromised ? t('Device at risk') : lockedWith}
              </Text>
            </Pressable>
          </View>
          <IconButton icon="settings-outline" accessibilityLabel={t('Settings')} onPress={() => router.push('/settings')} />
        </View>

        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="search"
          accessibilityLabel={t('Search documents')}
          style={({ pressed }) => [styles.search, pressed && { backgroundColor: colors.surfacePressed }]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text style={[type.body, { color: colors.textMuted, marginStart: spacing.sm, flex: 1 }]} numberOfLines={1}>
            {t('Search documents')}
          </Text>
        </Pressable>

        {/* The wallet: identity documents as physical cards */}
        {ids.length ? (
          <View style={{ marginTop: 22, height: ids.length > 1 ? 238 : 178 }}>
            {ids.map((d, i) => {
              const def = findDocTypeAny(d.docType)?.type;
              const days = daysUntil(d.expiryDate);
              const holder = field(d, 'fullName') ?? displayName(d.name);
              const number = field(d, 'documentNumber');
              const isPassport = d.docType === 'passport';
              if (i === 0) {
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => open(d)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(def?.label ?? 'Document')}, ${holder}`}
                    style={({ pressed }) => [
                      styles.cardTop,
                      { backgroundColor: isPassport ? colors.passport : colors.paper },
                      pressed && { transform: [{ scale: 0.99 }] },
                    ]}
                  >
                    <SecurityPrint color={isPassport ? colors.passportInk : '#9DB0CC'} width={350} height={170} opacity={isPassport ? 0.18 : 0.45} />
                    <Text style={[type.caption, { fontFamily: fonts.medium, color: isPassport ? colors.passportGold : colors.paperMuted }]}>
                      {t(def?.label ?? 'Document')}
                    </Text>
                    <View>
                      <Text style={[type.h2, { fontSize: 20, color: isPassport ? colors.passportInk : colors.paperInk }]} numberOfLines={1}>
                        {holder}
                      </Text>
                      <Text style={[type.mono, { color: isPassport ? colors.passportGold : colors.paperMuted, marginTop: 2 }]} numberOfLines={1}>
                        {[number, d.expiryDate ? t('valid to {date}', { date: formatDate(d.expiryDate) }) : null].filter(Boolean).join('  ·  ')}
                      </Text>
                    </View>
                    {days != null && days <= 90 ? (
                      <View style={styles.expiryPill}>
                        <Text style={[type.caption, { color: colors.paperWarn, fontFamily: fonts.semibold }]}>
                          {days < 0 ? t('Expired') : t('Expires in {n} days', { n: days })}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={d.id}
                  onPress={() => open(d)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(def?.label ?? 'Document')}, ${holder}`}
                  style={({ pressed }) => [styles.cardUnder, pressed && { transform: [{ scale: 0.99 }] }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type.h3, { fontSize: 15, color: colors.paperInk }]} numberOfLines={1}>
                      {t(def?.label ?? 'Document')}
                    </Text>
                    <Text style={[type.caption, { color: days != null && days <= 90 ? colors.paperWarn : colors.paperMuted }]} numberOfLines={1}>
                      {days != null && days < 0
                        ? t('Expired')
                        : days != null && days <= 90
                          ? t('Expires in {n} days', { n: days })
                          : holder}
                    </Text>
                  </View>
                  <Ionicons name={forward} size={18} color={colors.paperMuted} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Pressable
            onPress={() => router.push({ pathname: '/scan', params: { type: 'passport' } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.emptyCard, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="id-card-outline" size={26} color={colors.paperMuted} />
            <Text style={[type.h3, { color: colors.paperInk, marginTop: spacing.sm }]}>{t('Add your passport or ID card')}</Text>
            <Text style={[type.caption, { color: colors.paperMuted, marginTop: 2, textAlign: 'center' }]}>
              {t('Scan it once and keep it with you, encrypted on this phone.')}
            </Text>
          </Pressable>
        )}

        {/* Quick add for IDs (also for family members) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }} contentContainerStyle={{ gap: spacing.sm }}>
          {ESSENTIAL_TYPES.map((typeId) => {
            const def = findDocTypeAny(typeId)!.type;
            return (
              <Pressable
                key={typeId}
                onPress={() => router.push({ pathname: '/scan', params: { type: typeId } })}
                accessibilityRole="button"
                accessibilityLabel={`${t('Add')} ${t(def.label)}`}
                style={({ pressed }) => [styles.quick, pressed && { backgroundColor: colors.surfacePressed }]}
              >
                <Ionicons name="add" size={16} color={colors.primaryBright} />
                <Text style={[type.caption, { color: colors.textSecondary, marginStart: 4 }]}>{t(def.label)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* The two ways to add something */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push('/add')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="scan-outline" size={24} color={colors.onPrimary} />
            <Text style={[type.h3, { color: colors.onPrimary }]}>{t('Scan a document')}</Text>
          </Pressable>
          <Pressable
            onPress={chooseImport}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, styles.actionQuiet, pressed && { backgroundColor: colors.surfacePressed }]}
          >
            <Ionicons name="cloud-upload-outline" size={24} color={colors.primaryBright} />
            <Text style={type.h3}>{t('Import files')}</Text>
          </Pressable>
        </View>

        {expiringOther.length ? (
          <Pressable onPress={() => open(expiringOther[0])} style={styles.alert} accessibilityRole="button">
            <Ionicons name="alarm-outline" size={18} color={colors.warning} />
            <Text style={[type.bodySecondary, { flex: 1, marginStart: spacing.sm, color: colors.text }]}>
              {expiringOther.length === 1
                ? t('“{name}” expires soon', { name: displayName(expiringOther[0].name) })
                : t('{count} documents expire within 90 days', { count: expiringOther.length })}
            </Text>
            <Ionicons name={forward} size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {documents.length > 0 && !vault.settings.protectionInfoSeen ? (
          <View style={styles.info}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primaryBright} />
            <View style={{ flex: 1, marginStart: spacing.md }}>
              <Text style={type.h3}>{t('Saved and encrypted on this phone')}</Text>
              <Text style={[type.caption, { marginTop: 2 }]}>
                {t('Your documents are never uploaded or backed up. Important: Docsave cannot recover them if you forget your PIN, uninstall the app or lose this phone. Keep your original documents.')}
              </Text>
              <Pressable onPress={() => vault.updateSettings({ protectionInfoSeen: true })} accessibilityRole="button" hitSlop={8} style={{ marginTop: spacing.sm }}>
                <Text style={[type.caption, { color: colors.primaryBright, fontFamily: fonts.semibold }]}>{t('Got it')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.listHead}>
          <Text style={type.h3} accessibilityRole="header">
            {t('All documents')}
          </Text>
          {documents.length ? (
            <Text style={type.caption}>{documents.length === 1 ? t('1 saved') : t('{count} saved', { count: documents.length })}</Text>
          ) : null}
        </View>
        {documents.length === 0 ? (
          <EmptyState
            icon={'folder-open-outline' as IconName}
            title={t('Your vault is empty')}
            body={t('Scan a document or import files. Everything is encrypted before it is saved.')}
          />
        ) : (
          list.map((d) => <DocumentCard key={d.id} doc={d} custom={customCategories} onPress={() => open(d)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  status: { flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-start' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cardTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 170,
    borderRadius: 18,
    padding: 18,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadow,
  },
  expiryPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: colors.paper,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardUnder: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 150,
    height: 74,
    borderRadius: 16,
    backgroundColor: colors.paper,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow,
  },
  emptyCard: {
    marginTop: 22,
    height: 150,
    borderRadius: 18,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  action: { flex: 1, height: 92, borderRadius: 16, padding: 14, justifyContent: 'space-between' },
  actionQuiet: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  info: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.xs },
});
