import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExpiryField } from '../../src/components/ExpiryField';
import { ScannerModal, type Frame } from '../../src/components/ScannerModal';
import { Button, Chip, Header, Notice, Screen, SectionTitle, TextField, haptic, type IconName } from '../../src/components/ui';
import { wipe } from '../../src/crypto/core';
import { ImportError, importFromFiles, importFromPhotos } from '../../src/security/importers';
import { colors, radius, spacing, type } from '../../src/theme/theme';
import { allCategories, findDocType } from '../../src/vault/categories';
import type { PendingPage } from '../../src/vault/types';
import { useVault } from '../../src/vault/VaultContext';
import { formatBytes } from '../../src/utils/format';

type Source = 'camera' | 'photos' | 'files';

export default function AddDocument() {
  const params = useLocalSearchParams<{ categoryId?: string; docType?: string }>();
  const router = useRouter();
  const vault = useVault();
  const categories = allCategories(vault.index.customCategories);

  const [categoryId, setCategoryId] = useState(params.categoryId || 'identity');
  const [docType, setDocType] = useState<string | undefined>(params.docType || undefined);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [expiry, setExpiry] = useState<string | undefined>();
  const [pages, setPages] = useState<PendingPage[]>([]);
  const [sheetFor, setSheetFor] = useState<string | null>(null); // slot label awaiting a source
  const [scanFor, setScanFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const typeDef = findDocType(categoryId, docType);
  const slots = typeDef?.slots;
  const frame: Frame = typeDef?.frame ?? 'document';

  // Auto-name from the document type until the user edits the name.
  useEffect(() => {
    if (!nameTouched) setName(typeDef?.label ?? '');
  }, [typeDef?.label, nameTouched]);

  // Wipe in-memory plaintext if the user leaves without saving.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  useEffect(() => () => pagesRef.current.forEach((p) => wipe(p.bytes)), []);

  const nextLabel = useMemo(() => `Page ${pages.length + 1}`, [pages.length]);

  function putPage(page: PendingPage) {
    haptic.success();
    setPages((prev) => {
      const existing = prev.find((p) => p.label === page.label);
      if (existing) wipe(existing.bytes);
      const rest = prev.filter((p) => p.label !== page.label);
      const next = [...rest, page];
      if (slots) next.sort((a, b) => slots.indexOf(a.label) - slots.indexOf(b.label));
      return next;
    });
  }

  function removePage(label: string) {
    setPages((prev) => {
      prev.filter((p) => p.label === label).forEach((p) => wipe(p.bytes));
      const rest = prev.filter((p) => p.label !== label);
      return slots ? rest : rest.map((p, i) => ({ ...p, label: `Page ${i + 1}` }));
    });
  }

  async function pickSource(source: Source, label: string) {
    setSheetFor(null);
    setError(null);
    if (source === 'camera') {
      setScanFor(label);
      return;
    }
    setImporting(true);
    try {
      const page = await vault.runExternal(() => (source === 'photos' ? importFromPhotos(label) : importFromFiles(label)));
      if (page) putPage(page);
    } catch (e) {
      setError(e instanceof ImportError ? e.message : 'The file could not be imported.');
    } finally {
      setImporting(false);
    }
  }

  async function save() {
    if (!name.trim()) return setError('Give this document a name.');
    if (pages.length === 0) return setError('Add at least one page, photo or file.');
    setSaving(true);
    setError(null);
    try {
      const doc = await vault.addDocument({
        name,
        categoryId,
        docType,
        notes,
        expiryDate: expiry,
        pages,
      });
      setPages([]); // bytes were wiped by addDocument
      haptic.success();
      vault.markAuthenticated();
      router.replace({ pathname: '/document/[id]', params: { id: doc.id } });
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', (e as Error).message || 'Encryption or storage failed.');
    }
  }

  const expiryLabel = categoryId === 'travel' ? 'Travel date' : 'Expiry date';

  return (
    <>
      <Screen
        footer={
          <Button
            title={saving ? 'Encrypting…' : 'Encrypt & save'}
            icon="lock-closed"
            loading={saving}
            disabled={importing}
            onPress={save}
          />
        }
      >
        <Header title="Add document" subtitle="Encrypted on this device before saving" />

        <SectionTitle>Category</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name.replace(' Documents', '')}
              icon={c.icon as IconName}
              selected={c.id === categoryId}
              onPress={() => {
                setCategoryId(c.id);
                setDocType(undefined);
              }}
            />
          ))}
        </ScrollView>

        {category.types.length > 0 ? (
          <>
            <SectionTitle>Document type</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {category.types.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  selected={docType === t.id}
                  onPress={() => {
                    if (docType !== t.id) {
                      pages.forEach((p) => wipe(p.bytes));
                      setPages([]);
                    }
                    setDocType(t.id);
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        <SectionTitle>{slots ? 'Capture both sides' : 'Pages & files'}</SectionTitle>
        {slots ? (
          slots.map((slot) => {
            const page = pages.find((p) => p.label === slot);
            return (
              <SlotCard
                key={slot}
                title={`${typeDef?.label ?? 'Document'} — ${slot}`}
                page={page}
                onAdd={() => setSheetFor(slot)}
                onScan={() => pickSource('camera', slot)}
                onRemove={() => removePage(slot)}
              />
            );
          })
        ) : (
          <>
            {pages.map((p) => (
              <SlotCard key={p.label} title={p.label} page={p} onAdd={() => setSheetFor(p.label)} onRemove={() => removePage(p.label)} />
            ))}
            <Pressable
              onPress={() => setSheetFor(nextLabel)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.addPage, pressed && { backgroundColor: colors.surfacePressed }]}
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.primaryBright} />
              <Text style={[type.h3, { color: colors.primaryBright, marginLeft: spacing.sm }]}>
                {pages.length ? 'Add another page' : 'Add page, photo or file'}
              </Text>
            </Pressable>
          </>
        )}
        {importing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[type.caption, { marginLeft: spacing.sm }]}>Importing into memory…</Text>
          </View>
        ) : null}

        <SectionTitle>Details</SectionTitle>
        <TextField
          label="Document name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setNameTouched(true);
          }}
          placeholder="e.g. My passport"
          maxLength={80}
        />
        <ExpiryField
          label={expiryLabel}
          value={expiry}
          onChange={setExpiry}
          hint={
            categoryId === 'identity'
              ? 'Used for optional reminders (6 months, 30 days, 7 days before). Reminders never show document details.'
              : 'Used for optional reminders. Reminders never show document details.'
          }
        />
        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional private notes (encrypted)"
          multiline
          maxLength={1000}
        />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Notice tone="success" title="Encrypted locally">
          Files are encrypted with AES-256-GCM in memory, then written to Docsave's private storage. Temporary copies
          created by the camera or file picker are deleted immediately.
        </Notice>
      </Screen>

      <SourceSheet
        visible={sheetFor != null}
        label={sheetFor ?? ''}
        onClose={() => setSheetFor(null)}
        onPick={(s) => sheetFor && pickSource(s, sheetFor)}
      />
      <ScannerModal
        visible={scanFor != null}
        frame={frame}
        slotLabel={scanFor ? (slots ? `${typeDef?.label} — ${scanFor}` : scanFor) : undefined}
        onClose={() => setScanFor(null)}
        onCapture={(p) => {
          if (scanFor) putPage({ ...p, label: scanFor });
          setScanFor(null);
        }}
      />
    </>
  );
}

function SlotCard({
  title,
  page,
  onAdd,
  onScan,
  onRemove,
}: {
  title: string;
  page?: PendingPage;
  onAdd: () => void;
  onScan?: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.slot, page && { borderColor: colors.primaryBorder, borderStyle: 'solid' }]}>
      <View style={[styles.slotIcon, { backgroundColor: page ? colors.primarySoft : colors.surfaceAlt }]}>
        <Ionicons
          name={page ? 'checkmark-circle' : 'scan-outline'}
          size={24}
          color={page ? colors.primaryBright : colors.textSecondary}
        />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={type.h3} numberOfLines={1}>
          {title}
        </Text>
        <Text style={type.caption}>
          {page ? `${page.mimeType.split('/')[1]?.toUpperCase()} · ${formatBytes(page.bytes.length)} · ready to encrypt` : 'Not added yet'}
        </Text>
      </View>
      {page ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${title}`} style={styles.slotBtn}>
          <Ionicons name="trash-outline" size={19} color={colors.danger} />
        </Pressable>
      ) : (
        <>
          {onScan ? (
            <Pressable onPress={onScan} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Scan ${title}`} style={styles.slotBtn}>
              <Ionicons name="camera-outline" size={20} color={colors.primaryBright} />
            </Pressable>
          ) : null}
          <Pressable onPress={onAdd} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Add ${title}`} style={styles.slotBtn}>
            <Ionicons name="add" size={22} color={colors.primaryBright} />
          </Pressable>
        </>
      )}
    </View>
  );
}

function SourceSheet({
  visible,
  label,
  onClose,
  onPick,
}: {
  visible: boolean;
  label: string;
  onClose: () => void;
  onPick: (s: Source) => void;
}) {
  const items: { source: Source; icon: IconName; title: string; body: string }[] = [
    { source: 'camera', icon: 'scan-outline', title: 'Scan with camera', body: 'Guided frame for cards, passports and pages' },
    { source: 'photos', icon: 'images-outline', title: 'Choose from photos', body: 'Pick an existing photo of a document' },
    { source: 'files', icon: 'document-attach-outline', title: 'Import a file', body: 'PDF, JPG, PNG and other formats (max 25 MB)' },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={[type.h2, { marginBottom: spacing.lg }]}>Add {label.toLowerCase()}</Text>
        {items.map((i) => (
          <Pressable
            key={i.source}
            onPress={() => onPick(i.source)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: colors.surfacePressed }]}
          >
            <View style={[styles.slotIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={i.icon} size={22} color={colors.primaryBright} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={type.h3}>{i.title}</Text>
              <Text style={type.caption}>{i.body}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
        <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  slotIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  slotBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    marginLeft: spacing.sm,
  },
  addPage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.lg },
  sheetRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.xs },
});
