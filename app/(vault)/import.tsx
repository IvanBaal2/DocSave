import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isNativeSecurityAvailable, recognizeBest, rotateJpeg } from '../../modules/docsave-security';
import { Button, Chip, Header, Notice, Screen, TextField, haptic, type IconName } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { classify } from '../../src/scan/classify';
import { describeDocument, extract, suggestName } from '../../src/scan/extract';
import { nameFromFile, pickFiles, pickPhotos, type PickedFile } from '../../src/security/importers';
import { deleteTempFile } from '../../src/security/secureTemp';
import { colors, radius, spacing, type } from '../../src/theme/theme';
import { BUILT_IN_CATEGORIES, findDocTypeAny } from '../../src/vault/categories';
import type { DocField, PendingPage } from '../../src/vault/types';
import { useVault } from '../../src/vault/VaultContext';
import { formatBytes } from '../../src/utils/format';

/** Images up to this size are read on the device to suggest a category. */
const READ_LIMIT = 12 * 1024 * 1024;

type Item = {
  key: string;
  name: string;
  categoryId: string;
  docType: string;
  confident: boolean;
  page?: PendingPage;
  lines: string[];
  fields: DocField[];
  keyDate?: string;
  /** Name of a document that already contains this exact file. */
  duplicateOf?: string;
  /** Why the file cannot be saved (English source text). */
  problem?: string;
  saveFailed?: boolean;
};

const DEFAULT_TYPE: Record<string, string> = {
  identity: 'other_identity',
  travel: 'plane_ticket',
  personal: 'important_letter',
  cards: 'loyalty_card',
  coupons: 'coupon',
  receipts: 'receipt',
  other: 'other',
  photos: 'photo',
};

/**
 * Import one or many files (PDF, images, Word, text) from the device, the
 * Files app or the photo library. Each file gets a preview, a suggested name
 * and category, duplicate and damage checks, and is saved as its own document.
 */
export default function ImportDocuments() {
  const { source } = useLocalSearchParams<{ source?: 'files' | 'photos' }>();
  const router = useRouter();
  const vault = useVault();
  const { t } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
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
    if (!picked.length) {
      if (!items.length) router.back();
      return;
    }
    setProgress({ done: 0, total: picked.length });
    const seen = new Set(items.map((i) => i.page?.sha256).filter(Boolean));
    const out: Item[] = [];
    for (const [i, f] of picked.entries()) {
      out.push(await prepare(f, i, seen));
      setProgress({ done: i + 1, total: picked.length });
    }
    setItems((prev) => [...prev, ...out]);
    setProgress(null);
  }

  async function prepare(f: PickedFile, i: number, seen: Set<string | undefined>): Promise<Item> {
    const key = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    if (!f.page) {
      return { key, name: f.name, categoryId: 'other', docType: 'other', confident: false, lines: [], fields: [], problem: f.problem };
    }
    const page = { ...f.page };
    // Images picked from Files are read into memory so they can be previewed and read.
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
    if (page.base64 && page.mimeType.startsWith('image/') && isNativeSecurityAvailable) {
      try {
        const best = await recognizeBest(page.base64, 2000);
        lines = best.lines.map((l) => l.text);
        if (best.rotation) page.base64 = await rotateJpeg(page.base64, best.rotation);
      } catch {
        // Reading failed: the file is still imported, just not sorted automatically.
      }
    }
    const c = classify({ lines, fileName: page.fileName, mimeType: page.mimeType });
    const def = findDocTypeAny(c.docType)?.type;
    const ex = def ? extract(def.kind, lines) : undefined;
    const duplicateOf = page.sha256 ? existing.get(page.sha256) ?? (seen.has(page.sha256) ? t('another file in this import') : undefined) : undefined;
    seen.add(page.sha256);
    const fallback = page.mimeType.startsWith('image/') ? t('Photo {n}', { n: i + 1 }) : t('Document {n}', { n: i + 1 });
    const name = ex?.holder && def ? suggestName(t(def.label), ex.holder) : nameFromFile(page.fileName, fallback);
    page.label = page.mimeType.startsWith('image/') ? (c.categoryId === 'photos' ? 'Photo' : 'Page 1') : 'File';
    return {
      key,
      name,
      categoryId: c.categoryId,
      docType: c.docType,
      confident: c.confident,
      page,
      lines,
      fields: (ex?.fields ?? []).filter((x) => x.value.trim()),
      keyDate: ex?.keyDate,
      duplicateOf,
    };
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    pick(source === 'photos' ? 'photos' : 'files');
  }, []);

  function update(key: string, patch: Partial<Item>) {
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function remove(key: string) {
    setItems((all) => {
      const gone = all.find((i) => i.key === key);
      if (gone?.page?.fileUri) deleteTempFile(gone.page.fileUri);
      return all.filter((i) => i.key !== key);
    });
  }

  function changeCategory(item: Item, categoryId: string) {
    const keepType = BUILT_IN_CATEGORIES.find((c) => c.id === categoryId)?.types.some((x) => x.id === item.docType);
    const docType = keepType ? item.docType : DEFAULT_TYPE[categoryId] ?? 'other';
    const def = findDocTypeAny(docType)?.type;
    const ex = def ? extract(def.kind, item.lines) : undefined;
    update(item.key, { categoryId, docType, fields: (ex?.fields ?? []).filter((x) => x.value.trim()), keyDate: ex?.keyDate, confident: true });
  }

  const ready = items.filter((i) => i.page && !i.problem);

  async function saveAll() {
    setSaving(true);
    let failed = 0;
    for (const item of ready) {
      const def = findDocTypeAny(item.docType)?.type;
      try {
        await vault.addDocument({
          name: item.name.trim() || t('Untitled document'),
          categoryId: item.categoryId,
          docType: item.docType,
          fields: item.fields,
          expiryDate: item.keyDate,
          description: describeDocument(t(def?.label ?? 'Document'), item.fields),
          pages: [item.page!],
        });
        setItems((all) => all.filter((i) => i.key !== item.key));
      } catch {
        failed++;
        update(item.key, { saveFailed: true });
      }
    }
    setSaving(false);
    if (!failed) {
      haptic.success();
      router.back();
    }
  }

  if (progress) {
    return (
      <Screen>
        <Header title={t('Import files')} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[type.h2, { marginTop: spacing.lg }]}>{t('Reading {done} of {total}…', progress)}</Text>
          <Text style={[type.caption, { marginTop: spacing.sm }]}>{t('On-device recognition · no internet used')}</Text>
        </View>
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
      <Header title={t('Import files')} subtitle={t('Check each file before saving')} />

      {items.map((item) => (
        <ImportCard
          key={item.key}
          item={item}
          onName={(name) => update(item.key, { name })}
          onCategory={(c) => changeCategory(item, c)}
          onRemove={() => remove(item.key)}
        />
      ))}

      <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
        <Button title={t('Add files')} variant="secondary" icon="folder-open-outline" onPress={() => pick('files')} style={{ flex: 1 }} disabled={saving} />
        <View style={{ width: spacing.sm }} />
        <Button title={t('Add photos')} variant="secondary" icon="images-outline" onPress={() => pick('photos')} style={{ flex: 1 }} disabled={saving} />
      </View>
      <Text style={[type.caption, { marginTop: spacing.md }]}>
        {t('Supported: PDF, JPG, PNG, HEIC, Word and text files, up to 25 MB each and 20 files at a time.')}
      </Text>
    </Screen>
  );
}

function ImportCard({
  item,
  onName,
  onCategory,
  onRemove,
}: {
  item: Item;
  onName: (n: string) => void;
  onCategory: (c: string) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const page = item.page;
  const def = findDocTypeAny(item.docType)?.type;
  const icon: IconName = page?.mimeType === 'application/pdf' ? 'document-attach-outline' : page?.mimeType.startsWith('image/') ? 'image-outline' : 'document-text-outline';

  return (
    <View style={[styles.card, (item.problem || item.saveFailed) && { borderColor: colors.danger + '88' }]}>
      <View style={{ flexDirection: 'row' }}>
        {page?.base64 && page.mimeType.startsWith('image/') ? (
          <Image source={{ uri: `data:${page.mimeType};base64,${page.base64}` }} style={styles.thumb} resizeMode="cover" accessibilityLabel={t('Preview')} />
        ) : (
          <View style={[styles.thumb, styles.fileThumb]}>
            <Ionicons name={icon} size={30} color={item.problem ? colors.danger : colors.primaryBright} />
          </View>
        )}
        <View style={{ flex: 1, marginStart: spacing.md }}>
          {item.problem ? (
            <>
              <Text style={type.h3} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[type.caption, { color: colors.danger, marginTop: 4 }]}>{t(item.problem)}</Text>
            </>
          ) : (
            <>
              <Text style={[type.caption, { color: item.confident ? colors.primaryBright : colors.textSecondary }]}>
                {item.confident
                  ? t('Recognised as {type}', { type: t(def?.label ?? 'Document') })
                  : item.categoryId === 'photos'
                    ? t('Saved as a general photo. You can change the category.')
                    : t('Not recognised. Saved under Other Documents; you can change the category.')}
              </Text>
              {page?.size ? <Text style={[type.caption, { marginTop: 2 }]}>{formatBytes(page.size)}</Text> : null}
            </>
          )}
        </View>
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={t('Remove')} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="close-circle" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      {item.problem ? null : (
        <>
          <TextField label={t('Name')} value={item.name} onChangeText={onName} maxLength={80} style={{ marginTop: spacing.md }} />
          <Text style={[type.overline, { marginBottom: spacing.sm }]}>{t('Category')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {BUILT_IN_CATEGORIES.map((c) => (
              <Chip key={c.id} label={t(c.name)} selected={item.categoryId === c.id} onPress={() => onCategory(c.id)} />
            ))}
          </ScrollView>
          {item.fields.length ? (
            <Text style={[type.caption, { marginTop: spacing.sm }]}>
              {item.fields.length === 1 ? t('1 detail read automatically') : t('{count} details read automatically', { count: item.fields.length })}
            </Text>
          ) : null}
          {item.duplicateOf ? (
            <Notice tone="warning">{t('This file is already saved in “{name}”. You can remove it or save it again.', { name: item.duplicateOf })}</Notice>
          ) : null}
          {item.saveFailed ? <Notice tone="danger">{t('This file could not be saved. Tap Save to try again.')}</Notice> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  thumb: { width: 64, height: 80, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  fileThumb: { alignItems: 'center', justifyContent: 'center' },
});
