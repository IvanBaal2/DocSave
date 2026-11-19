import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExpiryBadge, iconForDocument } from '../../../src/components/DocumentCard';
import { ExpiryField } from '../../../src/components/ExpiryField';
import { FieldEditor } from '../../../src/components/FieldEditor';
import { describeDocument, withTemplate } from '../../../src/scan/extract';
import type { DocField } from '../../../src/vault/types';
import { Button, Chip, IconButton, Notice, TextField, haptic, type IconName } from '../../../src/components/ui';
import { TamperError, wipe } from '../../../src/crypto/core';
import { useReauth } from '../../../src/security/ReauthProvider';
import { colors, radius, spacing, type } from '../../../src/theme/theme';
import { allCategories, findCategory, findDocType, findDocTypeAny } from '../../../src/vault/categories';
import { useVault } from '../../../src/vault/VaultContext';
import { displayName, formatBytes, formatDate, formatTimestamp } from '../../../src/utils/format';
import { SecureViewer } from '../../../src/viewer/SecureViewer';

export default function DocumentViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const vault = useVault();
  const { authenticate } = useReauth();
  const doc = vault.index.documents.find((d) => d.id === id);

  const [authorized, setAuthorized] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [bytes, setBytes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rotation, setRotation] = useState(0);
  useEffect(() => setRotation(0), [pageIdx]);
  const bytesRef = useRef<string | null>(null);
  const authInFlight = useRef(false);

  const clear = useCallback(() => {
    bytesRef.current = null; // drop the only reference to the decrypted data
    setBytes(null);
  }, []);

  // Latest values in refs so the focus effect below runs once per focus,
  // not again on every vault state change.
  const vaultRef = useRef(vault);
  vaultRef.current = vault;
  const authRef = useRef(authenticate);
  authRef.current = authenticate;

  const requestAccess = useCallback(async () => {
    if (authInFlight.current) return;
    const v = vaultRef.current;
    if (!v.settings.reauthForDocuments || v.recentlyAuthenticated()) {
      setAuthorized(true);
      return;
    }
    authInFlight.current = true;
    try {
      setAuthorized(await authRef.current('Unlock to view this document'));
    } finally {
      authInFlight.current = false;
    }
  }, []);

  // Lock the viewer when the screen loses focus or the app leaves the foreground.
  useFocusEffect(
    useCallback(() => {
      requestAccess();
      const sub = AppState.addEventListener('change', (s) => {
        // 'background' (not 'inactive', which iOS also emits while Face ID is shown).
        // The PrivacyShield covers the screen during 'inactive'.
        if (s === 'background') {
          clear();
          setAuthorized(false);
        }
      });
      return () => {
        sub.remove();
        clear();
        setAuthorized(false);
      };
    }, [requestAccess, clear]),
  );

  const page = doc?.pages[pageIdx];

  useEffect(() => {
    if (!authorized || !page) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    clear();
    vaultRef.current
      .readPage(page.id)
      .then((b) => {
        if (cancelled) return;
        bytesRef.current = b;
        setBytes(b);
      })
      .catch((e) =>
        setError(
          e instanceof TamperError
            ? 'Integrity check failed: this encrypted file was modified or corrupted and cannot be trusted.'
            : (e as Error).message || 'The document could not be decrypted.',
        ),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [authorized, page?.id]);

  if (!doc) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl }}>
        <Notice tone="info">This document no longer exists.</Notice>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const cat = findCategory(doc.categoryId, vault.index.customCategories);
  const dt = findDocType(doc.categoryId, doc.docType);

  function confirmDelete() {
    Alert.alert('Delete document?', `"${displayName(doc!.name)}" and all its pages will be permanently deleted from this device. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!(await authenticate('Confirm deletion'))) return;
          clear();
          await vault.deleteDocument(doc!.id);
          haptic.success();
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" accessibilityLabel="Close document" onPress={() => router.back()} />
        <View style={{ flex: 1, marginHorizontal: spacing.md }}>
          <Text style={type.h2} numberOfLines={1}>
            {displayName(doc.name)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons name="lock-closed" size={11} color={colors.primary} />
            <Text style={[type.caption, { marginLeft: 4 }]} numberOfLines={1}>
              {dt?.label ?? cat?.name} · decrypted in memory only
            </Text>
          </View>
        </View>
        <IconButton icon="information-circle-outline" accessibilityLabel="Document details" onPress={() => setShowInfo(true)} />
      </View>

      {doc.pages.length > 1 ? (
        <View style={styles.tabs}>
          {doc.pages.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => setPageIdx(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === pageIdx }}
              style={[styles.tab, i === pageIdx && styles.tabActive]}
            >
              <Text style={[type.bodySecondary, { fontSize: 13 }, i === pageIdx && { color: colors.text, fontWeight: '600' }]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.viewer}>
        {!authorized ? (
          <View style={styles.center}>
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={34} color={colors.primaryBright} />
            </View>
            <Text style={[type.h2, { marginTop: spacing.lg }]}>Protected document</Text>
            <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl }]}>
              Authenticate to decrypt and view this document.
            </Text>
            <Button title="Unlock document" icon={vault.biometrics.icon} onPress={requestAccess} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Notice tone="danger" title="Cannot open document">
              {error}
            </Notice>
          </View>
        ) : loading || !bytes || !page ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[type.caption, { marginTop: spacing.md }]}>Verifying integrity and decrypting…</Text>
          </View>
        ) : (
          <SecureViewer key={page.id} base64={bytes} mimeType={page.mimeType} rotation={rotation} />
        )}
      </View>

      <View style={styles.toolbar}>
        <ToolbarButton icon="create-outline" label="Edit" onPress={() => setEditing(true)} />
        {page?.mimeType.startsWith('image/') ? (
          <ToolbarButton icon="refresh-outline" label="Rotate" onPress={() => setRotation((r) => (r + 90) % 360)} />
        ) : null}
        {doc.pages.length > 1 ? (
          <ToolbarButton
            icon="swap-horizontal"
            label={`Show ${doc.pages[(pageIdx + 1) % doc.pages.length].label}`}
            onPress={() => setPageIdx((i) => (i + 1) % doc.pages.length)}
          />
        ) : null}
        <ToolbarButton icon="trash-outline" label="Delete" danger onPress={confirmDelete} />
      </View>

      <Modal visible={showInfo} transparent animationType="slide" onRequestClose={() => setShowInfo(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setShowInfo(false)} />
        <View style={[styles.sheet, { maxHeight: '85%' }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
            <View style={[styles.docIcon, { backgroundColor: (cat?.color ?? colors.primary) + '1F' }]}>
              <Ionicons name={iconForDocument(doc)} size={24} color={cat?.color ?? colors.primaryBright} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={type.h2}>{displayName(doc.name)}</Text>
              <Text style={type.caption}>{dt?.label ?? cat?.name}</Text>
            </View>
            <ExpiryBadge date={doc.expiryDate} />
          </View>
          {doc.description ? (
            <View style={styles.desc}>
              <Ionicons name="sparkles-outline" size={15} color={colors.primaryBright} />
              <Text style={[type.bodySecondary, { flex: 1, marginLeft: spacing.sm }]}>{doc.description}</Text>
            </View>
          ) : null}
          {doc.fields?.length ? (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[type.overline, { marginBottom: spacing.xs }]}>Details</Text>
              {doc.fields.map((f) => (
                <View key={f.key} style={styles.fieldRow}>
                  <Text style={[type.bodySecondary, { width: 130 }]}>{f.label}</Text>
                  {f.value ? (
                    <Text style={[type.body, { flex: 1, textAlign: 'right' }]} selectable={false}>
                      {/date|expiry/i.test(f.key) && /^\d{4}-\d{2}-\d{2}$/.test(f.value) ? formatDate(f.value) : f.value}
                    </Text>
                  ) : (
                    <Text style={[type.caption, { flex: 1, textAlign: 'right', color: colors.warning }]}>Not recognised</Text>
                  )}
                </View>
              ))}
            </View>
          ) : null}
          <InfoRow icon="folder-outline" label="Category" value={cat?.name ?? '—'} />
          {doc.expiryDate ? (
            <InfoRow icon="calendar-outline" label={doc.categoryId === 'travel' ? 'Travel date' : 'Expires'} value={formatDate(doc.expiryDate)} />
          ) : null}
          <InfoRow icon="layers-outline" label="Pages" value={doc.pages.map((p) => p.label).join(', ')} />
          <InfoRow icon="server-outline" label="Encrypted size" value={formatBytes(doc.pages.reduce((n, p) => n + p.size, 0))} />
          <InfoRow icon="time-outline" label="Added" value={formatTimestamp(doc.createdAt)} />
          <InfoRow icon="shield-checkmark-outline" label="Protection" value="AES-256-GCM · per-file key" />
          {doc.notes ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={type.overline}>Notes</Text>
              <Text style={[type.body, { marginTop: spacing.xs }]}>{doc.notes}</Text>
            </View>
          ) : null}
          <Button title="Close" variant="secondary" onPress={() => setShowInfo(false)} style={{ marginTop: spacing.xl }} />
          </ScrollView>
        </View>
      </Modal>

      <EditModal visible={editing} onClose={() => setEditing(false)} docId={doc.id} />
    </SafeAreaView>
  );
}

function EditModal({ visible, onClose, docId }: { visible: boolean; onClose: () => void; docId: string }) {
  const vault = useVault();
  const doc = vault.index.documents.find((d) => d.id === docId);
  const [name, setName] = useState(displayName(doc?.name ?? ''));
  const [notes, setNotes] = useState(doc?.notes ?? '');
  const [expiry, setExpiry] = useState<string | undefined>(doc?.expiryDate);
  const [categoryId, setCategoryId] = useState(doc?.categoryId ?? 'other');
  const kind = findDocTypeAny(doc?.docType)?.type.kind ?? 'generic';
  const [fields, setFields] = useState<DocField[]>(withTemplate(kind, doc?.fields));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && doc) {
      setName(displayName(doc.name));
      setNotes(doc.notes ?? '');
      setExpiry(doc.expiryDate);
      setCategoryId(doc.categoryId);
      setFields(withTemplate(kind, doc.fields));
      setError(null);
    }
  }, [visible]);

  if (!doc) return null;

  async function save() {
    if (!name.trim()) return setError('The name cannot be empty.');
    await vault.updateDocument(docId, {
      name: name.trim(),
      notes: notes.trim() || undefined,
      expiryDate: expiry,
      categoryId,
      docType: categoryId === doc!.categoryId ? doc!.docType : undefined,
      fields: fields.some((f) => f.value.trim()) ? fields.filter((f) => f.value.trim()) : undefined,
      description: fields.length
        ? describeDocument(findDocType(doc!.categoryId, doc!.docType)?.label ?? name.trim(), fields, categoryId === 'travel' ? 'on' : 'expires')
        : doc!.description,
    });
    haptic.success();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgElevated }}>
        <View style={styles.header}>
          <Text style={[type.h2, { flex: 1 }]}>Edit document</Text>
          <IconButton icon="close" accessibilityLabel="Cancel editing" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
          <TextField label="Name" value={name} onChangeText={setName} maxLength={80} error={error} />
          <Text style={[type.overline, { marginBottom: spacing.sm }]}>Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg }}>
            {allCategories(vault.index.customCategories).map((c) => (
              <Chip
                key={c.id}
                label={c.name.replace(' Documents', '')}
                icon={c.icon as IconName}
                selected={categoryId === c.id}
                onPress={() => setCategoryId(c.id)}
              />
            ))}
          </View>
          <ExpiryField label={categoryId === 'travel' ? 'Travel date' : 'Expiry date'} value={expiry} onChange={setExpiry} />
          {fields.length ? (
            <>
              <Text style={[type.overline, { marginBottom: spacing.sm, marginTop: spacing.sm }]}>Details</Text>
              <FieldEditor fields={fields} onChange={setFields} />
            </>
          ) : null}
          <TextField label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={1000} />
          <Button title="Save changes" icon="checkmark" onPress={save} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ToolbarButton({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.toolBtn, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <Ionicons name={icon} size={21} color={danger ? colors.danger : colors.text} />
      <Text style={[type.caption, { marginTop: 3, color: danger ? colors.danger : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={[type.bodySecondary, { marginLeft: spacing.md, width: 110 }]}>{label}</Text>
      <Text style={[type.body, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.primaryBorder },
  viewer: {
    flex: 1,
    marginHorizontal: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  lockBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  toolBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  docIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  desc: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
