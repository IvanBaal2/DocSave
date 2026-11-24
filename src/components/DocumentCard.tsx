import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type, fonts } from '../theme/theme';
import { findCategory, findDocType, findDocTypeAny } from '../vault/categories';
import type { CustomCategory, DocumentRecord } from '../vault/types';
import { daysUntil, displayName, formatBytes, formatDate } from '../utils/format';
import { t } from '../i18n';
import type { IconName } from './ui';

/** Light "paper" tint per category for the document mark (ink icon on top). */
const PAPER_TINT: Record<string, string> = {
  identity: '#C9D8EE',
  travel: '#CFE0F5',
  personal: '#F3D9C9',
  cards: '#BFE6D6',
  wallet: '#BFE6D6',
  coupons: '#F6D7A8',
  receipts: '#F1E3AE',
  photos: '#DCD3F1',
  other: '#E3E8EF',
};

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
  const label = d < 0 ? t('Expired') : d === 0 ? t('Today') : d <= 180 ? t('{n} days left', { n: d }) : formatDate(date);
  return (
    <View style={[styles.badge, { borderColor: tone + '55', backgroundColor: tone + '18' }]}>
      <Text style={[type.caption, { color: tone, fontFamily: fonts.semibold }]}>{label}</Text>
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
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <View style={[styles.icon, { backgroundColor: PAPER_TINT[doc.categoryId] ?? colors.paper }]}>
        <Ionicons name={iconForDocument(doc)} size={20} color={colors.paperInk} />
      </View>
      <View style={{ flex: 1, marginStart: spacing.md }}>
        <Text style={type.h3} numberOfLines={1}>
          {displayName(doc.name)}
        </Text>
        <Text style={[type.caption, { marginTop: 3 }]} numberOfLines={1}>
          {doc.description && doc.description !== (dt?.label ?? '') && doc.description !== t(dt?.label ?? '')
            ? doc.description.replace(`${dt?.label ?? ''} · `, '').replace(`${t(dt?.label ?? '')} · `, '')
            : `${t(dt?.label ?? cat?.name ?? 'Document')} · ${doc.pages.length === 1 ? t('1 page') : t('{n} pages', { n: doc.pages.length })} · ${formatBytes(size)}`}
        </Text>
      </View>
      <ExpiryBadge date={doc.expiryDate} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 64,
  },
  icon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginStart: spacing.sm },
});
