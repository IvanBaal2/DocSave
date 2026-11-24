import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { isNativeSecurityAvailable, recognizeBest, rotateJpeg } from '../../modules/docsave-security';
import { Button, Header, Screen, haptic, privateInputProps, type IconName } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { classify } from '../../src/scan/classify';
import { describeDocument, extract, suggestName } from '../../src/scan/extract';
import { nameFromFile, pickFiles, pickPhotos, type PickedFile } from '../../src/security/importers';
import { deleteTempFile } from '../../src/security/secureTemp';
import { colors, radius, spacing, type } from '../../src/theme/theme';
import { formatBytes } from '../../src/utils/format';
import { BUILT_IN_CATEGORIES, findDocTypeAny } from '../../src/vault/categories';
import type { DocField, PendingPage } from '../../src/vault/types';
import { useVault } from '../../src/vault/VaultContext';

/** Images up to this size are read on the device to check and sort them. */
const READ_LIMIT = 12 * 1024 * 1024;

type Slip = {
  key: string;
  name: string;
  categoryId: string;
  docType: string;
  confident: boolean;
  page?: PendingPage;
  lines: string[];
  fields: DocField[];
  keyDate?: string;
  duplicateOf?: string;
  /** Why the file will not be saved (English source text). */
  problem?: string;
  saveFailed?: boolean;
};

const DEFAULT_TYPE: Record<string, string> = {
  identity: 'other_identity',
  travel: 'plane_ticket',
  personal: 'important_letter',
  cards: 'membership_card',
  coupons: 'coupon',
  receipts: 'receipt',
  other: 'other',
};

const fileKind = (mime?: string) =>
  mime === 'application/pdf' ? 'PDF' : mime?.includes('word') ? 'DOC' : mime === 'text/plain' ? 'TXT' : mime?.startsWith('image/') ? 'IMG' : 'FILE';

/**
 * Import documents that already exist as files or photos: work badges,
 * student cards, a family member's passport, PDFs from email. Each file gets a
 * preview, a name and a "What is it?" choice, and is checked first: pictures
 * that are not documents, damaged or unsupported files are not saved.
 */
export default function ImportDocuments() {
  const { source } = useLocalSearchParams<{ source?: 'files' | 'photos' }>();
  const router = useRouter();
  const vault = useVault();
  const { t } = useI18n();
  const [slips, setSlips] = useState<Slip[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  const existing = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of vault.index.documents) for (const p of d.pages) if (p.sha256) map.set(p.sha256, d.name);
    return map;
  }, [vault.index.documents]);

  async function pick(kind: 'files' | 'photos') {
    const picked: PickedFile[] = await vault.runExternal(() =>
      kind === 'photos' ? pickPhotos({ multiple: true }) : pickFiles({ multiple: true }),
    );
    if (!picked.length) return;
    setProgress({ done: 0, total: picked.length });
    const seen = new Set(slips.map((s) => s.page?.sha256).filter(Boolean));
    const out: Slip[] = [];
    for (const [i, f] of picked.entries()) {
      out.push(await prepare(f, i, seen));
      setProgress({ done: i + 1, total: picked.length });
    }
    setSlips((prev) => [...prev, ...out]);
    setProgress(null);
  }

  async function prepare(f: PickedFile, i: number, seen: Set<string | undefined>): Promise<Slip> {
    const key = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    if (!f.page) {
      return { key, name: f.name, categoryId: 'other', docType: 'other', confident: false, lines: [], fields: [], problem: f.problem };
    }
    const page = { ...f.page };
    if (page.fileUri && page.mimeType.startsWith('image/') && (page.size ?? 0) <= READ_LIMIT) {
      try {
        page.base64 = await new File(page.fileUri).base64();
        deleteTempFile(page.fileUri);
        page.fileUri = undefined;
      } catch {
        // keep the file path; it is still encrypted and saved normally
      }
    }
    let lines: string[] = [];
    let readFailed = false;
    if (page.base64 && page.mimeType.startsWith('image/') && isNativeSecurityAvailable) {
      try {
        const best = await recognizeBest(page.base64, 2000);
        lines = best.lines.map((l) => l.text);
        if (best.rotation) page.base64 = await rotateJpeg(page.base64, best.rotation);
      } catch {
        readFailed = true; // cannot check this picture: it is kept and can be sorted by hand
      }
    }
    const c = classify({ lines, fileName: page.fileName, mimeType: page.mimeType });
    const checkable = page.mimeType.startsWith('image/') && isNativeSecurityAvailable && !readFailed;
    const def = findDocTypeAny(c.docType)?.type;
    const ex = def ? extract(def.kind, lines) : undefined;
    const duplicateOf = page.sha256 ? existing.get(page.sha256) ?? (seen.has(page.sha256) ? t('another file in this import') : undefined) : undefined;
    seen.add(page.sha256);
    const fallback = t('Document {n}', { n: i + 1 });
    page.label = page.mimeType.startsWith('image/') ? 'Page 1' : 'File';
    return {
      key,
      name: ex?.holder && def ? suggestName(t(def.label), ex.holder) : nameFromFile(page.fileName, fallback),
      categoryId: c.categoryId,
      docType: c.docType,
      confident: c.confident,
      page,
      lines,
      fields: (ex?.fields ?? []).filter((x) => x.value.trim()),
      keyDate: ex?.keyDate,
      duplicateOf,
      problem: checkable && c.notDocument ? 'This picture does not look like a document, so it will not be saved.' : undefined,
    };
  }

  useEffect(() => {
    if (started.current || !source) return;
    started.current = true;
    pick(source);
  }, [source]);

  function update(key: string, patch: Partial<Slip>) {
    setSlips((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function remove(key: string) {
    setSlips((all) => {
      const gone = all.find((s) => s.key === key);
      if (gone?.page?.fileUri) deleteTempFile(gone.page.fileUri);
      return all.filter((s) => s.key !== key);
    });
  }

  function changeCategory(slip: Slip, categoryId: string) {
    const keepType = BUILT_IN_CATEGORIES.find((c) => c.id === categoryId)?.types.some((x) => x.id === slip.docType);
    const docType = keepType ? slip.docType : DEFAULT_TYPE[categoryId] ?? 'other';
    const def = findDocTypeAny(docType)?.type;
    const ex = def ? extract(def.kind, slip.lines) : undefined;
    update(slip.key, { categoryId, docType, fields: (ex?.fields ?? []).filter((x) => x.value.trim()), keyDate: ex?.keyDate, confident: true });
  }

  const ready = slips.filter((s) => s.page && !s.problem);

  async function saveAll() {
    setSaving(true);
    let failed = 0;
    for (const slip of ready) {
      const def = findDocTypeAny(slip.docType)?.type;
      try {
        await vault.addDocument({
          name: slip.name.trim() || t('Untitled document'),
          categoryId: slip.categoryId,
          docType: slip.docType,
          fields: slip.fields,
          expiryDate: slip.keyDate,
          description: describeDocument(t(def?.label ?? 'Document'), slip.fields),
          pages: [slip.page!],
        });
        setSlips((all) => all.filter((s) => s.key !== slip.key));
      } catch {
        failed++;
        update(slip.key, { saveFailed: true });
      }
    }
    setSaving(false);
    if (!failed) {
      haptic.success();
      router.dismissTo('/');
    }
  }

  if (progress) {
    return (
      <Screen>
        <Header title={t('Import')} />
        <View style={styles.reading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[type.h2, { marginTop: spacing.lg }]}>{t('Reading {done} of {total}…', progress)}</Text>
          <Text style={[type.caption, { marginTop: spacing.sm }]}>{t('On-device recognition · no internet used')}</Text>
        </View>
      </Screen>
    );
  }

  // Nothing picked yet: two clear sources.
  if (!slips.length) {
    return (
      <Screen>
        <Header title={t('Import')} />
        <Text style={[type.h1, { marginTop: spacing.md }]}>{t('Where is the document?')}</Text>
        <Text style={[type.bodySecondary, { marginTop: spacing.sm }]}>
          {t('A work badge, a student card, a family member’s passport, a PDF from your email. Pick one or several at once.')}
        </Text>
        <View style={styles.sources}>
          <SourceButton
            icon="document-text-outline"
            title={t('Files')}
            detail={t('PDF, Word, scans, images')}
            onPress={() => pick('files')}
          />
          <SourceButton icon="images-outline" title={t('Photos')} detail={t('Pictures of documents')} onPress={() => pick('photos')} />
        </View>
        <Text style={[type.caption, { marginTop: spacing.lg }]}>
          {t('Up to 20 files at a time, 25 MB each. Pictures that are not documents are not saved.')}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        ready.length ? (
          <Button
            title={ready.length === 1 ? t('Encrypt & save') : t('Encrypt & save {count} documents', { count: ready.length })}
            icon="lock-closed"
            loading={saving}
            onPress={saveAll}
          />
        ) : undefined
      }
    >
      <Header title={t('Import')} subtitle={t('Check each file before saving')} />
      {slips.map((s) => (
        <DocumentSlip
          key={s.key}
          slip={s}
          onName={(name) => update(s.key, { name })}
          onCategory={(c) => changeCategory(s, c)}
          onRemove={() => remove(s.key)}
        />
      ))}
      <View style={styles.more}>
        <Button title={t('Add files')} variant="secondary" icon="document-text-outline" onPress={() => pick('files')} style={{ flex: 1 }} disabled={saving} />
        <View style={{ width: spacing.sm }} />
        <Button title={t('Add photos')} variant="secondary" icon="images-outline" onPress={() => pick('photos')} style={{ flex: 1 }} disabled={saving} />
      </View>
    </Screen>
  );
}

function SourceButton({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      style={({ pressed }) => [styles.source, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <Ionicons name={icon} size={30} color={colors.primaryBright} />
      <Text style={[type.h2, { marginTop: spacing.md }]}>{title}</Text>
      <Text style={[type.caption, { marginTop: 2 }]}>{detail}</Text>
    </Pressable>
  );
}

function DocumentSlip({
  slip,
  onName,
  onCategory,
  onRemove,
}: {
  slip: Slip;
  onName: (n: string) => void;
  onCategory: (c: string) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const page = slip.page;
  const def = findDocTypeAny(slip.docType)?.type;
  const refused = !!slip.problem;
  const isImage = !!page?.base64 && page.mimeType.startsWith('image/');

  return (
    <View style={[styles.slip, refused && { borderColor: colors.danger + '66' }]}>
      {/* Preview strip: the document itself, with its file type stamped in the corner */}
      <View style={styles.preview}>
        {isImage ? (
          <Image source={{ uri: `data:${page!.mimeType};base64,${page!.base64}` }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={t('Preview')} />
        ) : (
          <Ionicons name={refused ? 'alert-circle-outline' : 'document-text-outline'} size={42} color={refused ? colors.danger : colors.textMuted} />
        )}
        <View style={styles.stamp}>
          <Text style={styles.stampText}>
            {fileKind(page?.mimeType)}
            {page?.size ? `  ${formatBytes(page.size)}` : ''}
          </Text>
        </View>
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={t('Remove')} hitSlop={10} style={styles.remove}>
          <Ionicons name="close" size={18} color="#fff" />
        </Pressable>
      </View>

      <View style={{ padding: spacing.lg }}>
        {refused ? (
          <>
            <Text style={type.h3} numberOfLines={2}>
              {slip.name}
            </Text>
            <Text style={[type.bodySecondary, { color: colors.danger, marginTop: 4 }]}>{t(slip.problem!)}</Text>
          </>
        ) : (
          <>
            <TextInput
              {...privateInputProps}
              value={slip.name}
              onChangeText={onName}
              maxLength={80}
              accessibilityLabel={t('Name')}
              placeholder={t('Name')}
              placeholderTextColor={colors.textMuted}
              style={styles.name}
            />
            <Text style={[type.caption, { marginTop: 2, color: slip.confident ? colors.primaryBright : colors.textSecondary }]}>
              {slip.confident ? t('Recognised as {type}', { type: t(def?.label ?? 'Document') }) : t('Choose what it is below.')}
              {slip.fields.length ? `  ${slip.fields.length === 1 ? t('1 detail read automatically') : t('{count} details read automatically', { count: slip.fields.length })}` : ''}
            </Text>

            <Text style={[type.h3, { fontSize: 14, marginTop: spacing.lg, marginBottom: spacing.sm }]}>{t('What is it?')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {BUILT_IN_CATEGORIES.map((c) => {
                const on = slip.categoryId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => onCategory(c.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={[styles.kind, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Ionicons name={c.icon as IconName} size={16} color={on ? '#03140D' : colors.textSecondary} />
                    <Text style={[type.caption, { marginStart: 6, color: on ? '#03140D' : colors.text }]}>{t(c.name)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {slip.duplicateOf ? (
              <Text style={[type.caption, { color: colors.warning, marginTop: spacing.md }]}>
                {t('This file is already saved in “{name}”. You can remove it or save it again.', { name: slip.duplicateOf })}
              </Text>
            ) : null}
            {slip.saveFailed ? (
              <Text style={[type.caption, { color: colors.danger, marginTop: spacing.md }]}>{t('This file could not be saved. Tap Save to try again.')}</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  sources: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  source: {
    flex: 1,
    height: 168,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    justifyContent: 'flex-end',
  },
  slip: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  preview: { height: 132, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  stamp: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(5,8,15,0.78)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stampText: { color: '#fff', fontSize: 12, letterSpacing: 0.4 },
  remove: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(5,8,15,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...type.h2, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  kind: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  more: { flexDirection: 'row', marginTop: spacing.sm },
});
