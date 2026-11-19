import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DocumentCard } from '../../src/components/DocumentCard';
import { EmptyState, FadeIn, IconButton, Logo, SectionTitle, Button, type IconName } from '../../src/components/ui';
import { colors, gradients, radius, shadow, spacing, type } from '../../src/theme/theme';
import { allCategories } from '../../src/vault/categories';
import { useVault } from '../../src/vault/VaultContext';
import { autoLockLabel, daysUntil } from '../../src/utils/format';

export default function Dashboard() {
  const router = useRouter();
  const vault = useVault();
  const { documents, customCategories } = vault.index;
  const categories = useMemo(() => allCategories(customCategories), [customCategories]);
  const recent = useMemo(() => [...documents].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5), [documents]);
  const expiring = useMemo(
    () => documents.filter((d) => {
      const n = daysUntil(d.expiryDate);
      return n != null && n <= 90;
    }).length,
    [documents],
  );
  const mode = vault.meta?.unlockMode ?? 'pin';
  const compromised = vault.integrity.compromised;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Logo size={36} />
          <View style={{ flexDirection: 'row' }}>
            <IconButton icon="lock-closed-outline" accessibilityLabel="Lock vault now" onPress={vault.lock} />
            <View style={{ width: spacing.sm }} />
            <IconButton icon="settings-outline" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
          </View>
        </View>

        <FadeIn>
          <LinearGradient
            colors={compromised ? ['#2A1F0E', '#120D05'] : ['#0F2A22', '#0A1424']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.statusCard, { borderColor: compromised ? colors.warning + '55' : colors.primaryBorder }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.statusIcon, { backgroundColor: compromised ? colors.warningSoft : colors.primarySoft }]}>
                <Ionicons
                  name={compromised ? 'warning' : 'shield-checkmark'}
                  size={26}
                  color={compromised ? colors.warning : colors.primaryBright}
                />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={type.overline}>Security status</Text>
                <Text style={[type.h2, { color: compromised ? colors.warning : colors.primaryBright }]}>
                  {compromised ? 'Device at risk' : 'Vault protected'}
                </Text>
              </View>
              <View style={styles.liveDot} />
            </View>
            <Text style={[type.bodySecondary, { marginTop: spacing.md }]}>
              Your documents are encrypted and stored privately on this device.
            </Text>
            <View style={styles.badges}>
              <Badge icon="key-outline" label="AES-256-GCM" />
              <Badge
                icon={mode === 'pin' ? 'keypad-outline' : vault.biometrics.icon}
                label={mode === 'pin' ? 'PIN' : mode === 'pin_and_bio' ? `${vault.biometrics.label} + PIN` : vault.biometrics.label}
              />
              <Badge icon="timer-outline" label={autoLockLabel(vault.settings.autoLockSeconds).replace('After ', 'Lock ')} />
              <Badge icon="cloud-offline-outline" label="Offline" />
            </View>
          </LinearGradient>
        </FadeIn>

        <FadeIn delay={80}>
          <View style={styles.stats}>
            <Stat value={documents.length} label="Documents" icon="documents-outline" />
            <Stat value={expiring} label="Expiring ≤ 90d" icon="alarm-outline" tone={expiring ? colors.warning : undefined} />
            <Stat value={categories.length} label="Categories" icon="albums-outline" />
          </View>
        </FadeIn>

        <FadeIn delay={140}>
          <Pressable
            onPress={() => router.push('/search')}
            accessibilityRole="search"
            accessibilityLabel="Search documents"
            style={({ pressed }) => [styles.search, pressed && { backgroundColor: colors.surfacePressed }]}
          >
            <Ionicons name="search" size={19} color={colors.textMuted} />
            <Text style={[type.bodySecondary, { marginLeft: spacing.md, flex: 1 }]}>Search documents</Text>
            <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          </Pressable>
        </FadeIn>

        <SectionTitle
          action={
            <Pressable onPress={() => router.push('/categories')} accessibilityRole="button" hitSlop={8}>
              <Text style={[type.caption, { color: colors.primaryBright }]}>Manage folders</Text>
            </Pressable>
          }
        >
          Categories
        </SectionTitle>
        <View style={styles.grid}>
          {categories.map((c, i) => {
            const count = documents.filter((d) => d.categoryId === c.id).length;
            return (
              <FadeIn key={c.id} delay={180 + i * 40} style={styles.tileWrap}>
                <Pressable
                  onPress={() => router.push({ pathname: '/category/[id]', params: { id: c.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, ${count} documents`}
                  style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.surfacePressed, transform: [{ scale: 0.98 }] }]}
                >
                  <View style={[styles.tileIcon, { backgroundColor: c.color + '1F' }]}>
                    <Ionicons name={c.icon as IconName} size={22} color={c.color} />
                  </View>
                  <Text style={[type.h3, { marginTop: spacing.md }]} numberOfLines={2}>
                    {c.name}
                  </Text>
                  <Text style={[type.caption, { marginTop: 2 }]}>
                    {count} {count === 1 ? 'document' : 'documents'}
                  </Text>
                </Pressable>
              </FadeIn>
            );
          })}
        </View>

        <SectionTitle>Recently added</SectionTitle>
        {recent.length === 0 ? (
          <EmptyState
            icon="shield-outline"
            title="Your vault is empty"
            body="Add your passport, ID card, tickets or any important document. Everything is encrypted before it is saved."
            action={<Button title="Add your first document" icon="add" onPress={() => router.push('/add')} />}
          />
        ) : (
          recent.map((d) => (
            <DocumentCard
              key={d.id}
              doc={d}
              custom={customCategories}
              onPress={() => router.push({ pathname: '/document/[id]', params: { id: d.id } })}
            />
          ))
        )}
      </ScrollView>

      <View style={styles.fabWrap} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push('/add')}
          accessibilityRole="button"
          accessibilityLabel="Add document"
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="add" size={24} color="#03140D" />
          <Text style={[type.button, { color: '#03140D', marginLeft: 6 }]}>Add Document</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Badge({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={12} color={colors.primaryBright} />
      <Text style={[type.caption, { color: colors.text, marginLeft: 5 }]}>{label}</Text>
    </View>
  );
}

function Stat({ value, label, icon, tone }: { value: number; label: string; icon: IconName; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={tone ?? colors.primaryBright} />
      <Text style={[type.h1, { marginTop: 6, color: tone ?? colors.text }]}>{value}</Text>
      <Text style={type.caption} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  statusCard: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.xl },
  statusIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primaryBright,
    shadowColor: colors.primaryBright,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginTop: 6,
  },
  stats: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 52,
    marginTop: spacing.lg,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  tileWrap: { width: '50%', padding: spacing.xs },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: 132,
  },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fabWrap: { position: 'absolute', left: 0, right: 0, bottom: spacing.xxl, alignItems: 'center' },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: spacing.xl,
    borderRadius: 28,
    overflow: 'hidden',
    ...shadow,
  },
});
