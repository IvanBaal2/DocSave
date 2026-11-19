import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme/theme';
import { findCategory, findDocType, findDocTypeAny } from '../vault/categories';
import type { CustomCategory, DocumentRecord } from '../vault/types';
import { daysUntil, displayName, formatBytes, formatDate } from '../utils/format';
import type { IconName } from './ui';

export function iconForDocument(doc: DocumentRecord): IconName {
  const known = findDocTypeAny(doc.docType);
  if (known) return known.type.icon as IconName;
  const t = doc.docType ?? '';
  if (t === 'passport') return 'globe-outline';
  if (['national_id', 'residence_permit'].includes(t)) return 'id-card-outline';
  if (t === 'driving_licence') return 'car-outline';
  if (['plane_ticket', 'boarding_pass'].includes(t)) return 'airplane-outline';
  if (t === 'train_ticket') return 'train-outline';
  if (t === 'hotel_reservation') return 'bed-outline';
  if (t === 'travel_insurance' || t === 'medical_document') return 'medkit-outline';
  if (t === 'receipt') return 'receipt-outline';
  if (doc.pages[0]?.mimeType === 'application/pdf') return 'document-attach-outline';
  if (doc.pages[0]?.mimeType.startsWith('image/')) return 'image-outline';
  return 'document-text-outline';
}

export function ExpiryBadge({ date }: { date?: string }) {
  if (!date) return null;
  const d = daysUntil(date);
  if (d == null) return null;
  const tone = d < 0 ? colors.danger : d <= 30 ? colors.warning : d <= 180 ? colors.info : colors.textMuted;
  const label = d < 0 ? 'Expired' : d === 0 ? 'Today' : d <= 180 ? `${d}d left` : formatDate(date);
  return (
    <View style={[styles.badge, { borderColor: tone + '55', backgroundColor: tone + '18' }]}>
      <Text style={[type.caption, { color: tone, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function DocumentCard({
  doc,
  custom,
  onPress,
}: {
  doc: DocumentRecord;
  custom: CustomCategory[];
  onPress: () => void;
}) {
  const cat = findCategory(doc.categoryId, custom);
  const dt = findDocType(doc.categoryId, doc.docType);
  const size = doc.pages.reduce((n, p) => n + p.size, 0);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${displayName(doc.name)}, ${dt?.label ?? cat?.name ?? 'document'}`}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfacePressed, transform: [{ scale: 0.99 }] }]}
    >
      <View style={[styles.icon, { backgroundColor: (cat?.color ?? colors.primary) + '1F' }]}>
        <Ionicons name={iconForDocument(doc)} size={22} color={cat?.color ?? colors.primaryBright} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={type.h3} numberOfLines={1}>
          {displayName(doc.name)}
        </Text>
        <Text style={[type.caption, { marginTop: 3 }]} numberOfLines={1}>
          {doc.description && doc.description !== (dt?.label ?? '')
            ? doc.description.replace(`${dt?.label ?? ''} · `, '')
            : `${dt?.label ?? cat?.name ?? 'Document'} · ${doc.pages.length} ${doc.pages.length === 1 ? 'page' : 'pages'} · ${formatBytes(size)}`}
        </Text>
      </View>
      <ExpiryBadge date={doc.expiryDate} />
      <Ionicons name="lock-closed" size={13} color={colors.primary} style={{ marginLeft: spacing.sm }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    paddingRight: spacing.lg,
    marginBottom: spacing.sm,
  },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginLeft: spacing.sm },
});
