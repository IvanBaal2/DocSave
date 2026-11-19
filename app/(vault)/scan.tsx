import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isNativeSecurityAvailable, recognizeText } from '../../modules/docsave-security';
import { ExpiryField } from '../../src/components/ExpiryField';
import { FieldEditor } from '../../src/components/FieldEditor';
import { GuidedCamera, type CapturedSide } from '../../src/components/GuidedCamera';
import { Button, Header, Notice, Screen, SectionTitle, TextField, haptic } from '../../src/components/ui';
import { describeDocument, extract, suggestName, type Extraction } from '../../src/scan/extract';
import { ImportError, importFromFiles, importFromPhotos } from '../../src/security/importers';
import { colors, radius, spacing, type } from '../../src/theme/theme';
import { GENERIC_TYPE, findCategory, findDocTypeAny } from '../../src/vault/categories';
import type { DocField, PendingPage } from '../../src/vault/types';
import { useVault } from '../../src/vault/VaultContext';
import { formatBytes } from '../../src/utils/format';

type Page = PendingPage & { lines: string[]; barcode?: string };
type Phase = 'camera' | 'flip' | 'reading' | 'review' | 'saving';

export default function ScanDocument() {
  const params = useLocalSearchParams<{ type?: string; categoryId?: string }>();
  const router = useRouter();
  const vault = useVault();

  const found = findDocTypeAny(params.type);
  const docType = found?.type ?? GENERIC_TYPE;
  const categoryId = params.categoryId || found?.category.id || 'other';
  const category = findCategory(categoryId, vault.index.customCategories);
  const isCustom = docType.id === 'custom';

  const [pages, setPages] = useState<Page[]>([]);
  const [phase, setPhase] = useState<Phase>(docType.importFirst ? 'reading' : 'camera');
  const [cameraLabel, setCameraLabel] = useState(docType.slots[0]);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [fields, setFields] = useState<DocField[]>([]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [keyDate, setKeyDate] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const flip = useRef(new Animated.Value(0)).current;

  const requiredSlots = docType.optionalFrom ?? docType.slots.length;
  const sideIndex = Math.max(0, docType.slots.indexOf(cameraLabel));

  // ── Capture flow ──────────────────────────────────────────────────────────

  function nextMissingSlot(list: Page[]): string | undefined {
    return docType.slots.find((s) => !list.some((p) => p.label === s));
  }

  function sortPages(list: Page[]): Page[] {
    const order = (l: string) => {
      const i = docType.slots.indexOf(l);
      return i >= 0 ? i : 100 + Number(/\d+/.exec(l)?.[0] ?? 0);
    };
    return [...list].sort((a, b) => order(a.label) - order(b.label));
  }

  function afterAdd(list: Page[]) {
    const missing = nextMissingSlot(list);
    const capturedSlots = docType.slots.filter((s) => list.some((p) => p.label === s)).length;
    if (missing && (capturedSlots < requiredSlots || docType.optionalFrom != null) && phase !== 'review' && !extraction) {
      setCameraLabel(missing);
      if (docType.frame === 'card') {
        setPhase('flip');
        flip.setValue(0);
        Animated.timing(flip, { toValue: 1, duration: 900, useNativeDriver: true }).start();
        setTimeout(() => setPhase((p) => (p === 'flip' ? 'camera' : p)), 2200);
      } else {
        setPhase('camera');
      }
      return;
    }
    runExtraction(list);
  }

  function onCaptured(side: CapturedSide) {
    const page: Page = { label: cameraLabel, mimeType: 'image/jpeg', base64: side.base64, lines: side.lines, barcode: side.barcode };
    const list = sortPages([...pages.filter((p) => p.label !== cameraLabel), page]);
    setPages(list);
    if (extraction) {
      runExtraction(list); // retake / extra page while reviewing
    } else {
      afterAdd(list);
    }
  }

  function runExtraction(list: Page[]) {
    setPhase('reading');
    const lines = list.flatMap((p) => p.lines);
    const barcode = list.find((p) => p.barcode)?.barcode;
    const ex = extract(docType.kind, lines, barcode);
    // Keep anything the user already typed when re-running after a retake.
    const merged = ex.fields.map((f) => {
      const prev = fields.find((x) => x.key === f.key);
      return prev && (prev.status === 'edited' || prev.status === 'manual') ? prev : f;
    });
    setExtraction(ex);
    setFields(merged);
    if (!name || (!isCustom && name === suggestName(docType.label, extraction?.holder))) {
      setName(isCustom ? '' : suggestName(docType.label, ex.holder));
    }
    if (ex.keyDate && !keyDate) setKeyDate(ex.keyDate);
    if (!ex.keyDate) {
      const exp = merged.find((f) => f.key === 'expiryDate' || f.key === 'travelDate')?.value;
      if (exp && !keyDate) setKeyDate(exp);
    }
    setTimeout(() => setPhase('review'), 250);
  }

  async function importInstead(label = cameraLabel) {
    const choose = () =>
      new Promise<'photos' | 'files' | null>((resolve) =>
        Alert.alert('Import', 'Where is the document?', [
          { text: 'Photo library', onPress: () => resolve('photos') },
          { text: 'Files (PDF, images…)', onPress: () => resolve('files') },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ]),
      );
    const source = docType.importFirst ? 'files' : await choose();
    if (!source) {
      if (docType.importFirst && pages.length === 0) router.back();
      return;
    }
    setError(null);
    try {
      const picked = await vault.runExternal(() => (source === 'photos' ? importFromPhotos(label) : importFromFiles(label)));
      if (!picked) {
        if (docType.importFirst && pages.length === 0) router.back();
        return;
      }
      setPhase('reading');
      let lines: string[] = [];
      if (picked.base64 && isNativeSecurityAvailable && picked.mimeType.startsWith('image/')) {
        try {
          lines = (await recognizeText(picked.base64)).lines.map((l) => l.text);
        } catch {
          lines = [];
        }
      }
      const list = sortPages([...pages.filter((p) => p.label !== label), { ...picked, lines }]);
      setPages(list);
      if (extraction) runExtraction(list);
      else afterAdd(list);
    } catch (e) {
      setError(e instanceof ImportError ? e.message : 'The file could not be imported.');
      setPhase(pages.length ? 'review' : 'camera');
    }
  }

  useEffect(() => {
    if (docType.importFirst) importInstead(docType.slots[0]);
  }, []);

  // ── Review & save ─────────────────────────────────────────────────────────

  const keyDateLabel = categoryId === 'travel' ? 'travel' : 'expires';
  const description = useMemo(
    () => describeDocument(isCustom && name ? name : docType.label, fields, keyDateLabel === 'travel' ? 'on' : 'expires'),
    [fields, docType.label, isCustom, name, keyDateLabel],
  );

  async function save() {
    if (!name.trim()) return setError('Give this document a name.');
    if (!pages.length) return setError('Capture or import at least one page.');
    setPhase('saving');
    setError(null);
    try {
      const doc = await vault.addDocument({
        name,
        categoryId,
        docType: docType.id,
        notes,
        expiryDate: keyDate,
        fields: fields.filter((f) => f.value.trim() || f.status === 'missing'),
        description,
        pages: pages.map(({ label, mimeType, base64, fileUri, size }) => ({ label, mimeType, base64, fileUri, size })),
      });
      setPages([]);
      haptic.success();
      vault.markAuthenticated();
      router.dismissTo?.('/');
      router.push({ pathname: '/document/[id]', params: { id: doc.id } });
    } catch (e) {
      setPhase('review');
      Alert.alert('Could not save', (e as Error).message || 'Encryption or storage failed.');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'camera') {
    const optional = docType.optionalFrom != null && sideIndex >= docType.optionalFrom;
    const isExtra = !docType.slots.includes(cameraLabel);
    return (
      <GuidedCamera
        key={cameraLabel}
        docType={docType}
        sideIndex={isExtra ? 0 : sideIndex}
        stepLabel={cameraLabel}
        stepCount={isExtra ? 1 : docType.slots.length}
        optional={optional}
        onCaptured={onCaptured}
        onSkip={() => runExtraction(pages)}
        onImport={() => importInstead(cameraLabel)}
        onClose={() => (pages.length ? runExtraction(pages) : router.back())}
      />
    );
  }

  if (phase === 'flip') {
    return (
      <View style={styles.flip}>
        <Animated.View
          style={{
            transform: [
              { perspective: 800 },
              { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
            ],
          }}
        >
          <View style={styles.flipCard}>
            <Ionicons name="id-card-outline" size={56} color={colors.primaryBright} />
          </View>
        </Animated.View>
        <Ionicons name="checkmark-circle" size={28} color={colors.primaryBright} style={{ marginTop: spacing.xl }} />
        <Text style={[type.h1, { marginTop: spacing.md, textAlign: 'center' }]}>
          {pages[pages.length - 1]?.label} captured
        </Text>
        <Text style={[type.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
          Now turn the card over to scan the {cameraLabel.toLowerCase()}.
        </Text>
        <Button title="Continue" onPress={() => setPhase('camera')} style={{ marginTop: spacing.xxl, alignSelf: 'stretch' }} />
      </View>
    );
  }

  if (phase === 'reading' || phase === 'saving') {
    return (
      <View style={styles.flip}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[type.h2, { marginTop: spacing.lg }]}>{phase === 'saving' ? 'Encrypting and saving…' : 'Reading on this device…'}</Text>
        <Text style={[type.caption, { marginTop: spacing.sm, textAlign: 'center' }]}>
          {phase === 'saving' ? 'AES-256-GCM · nothing leaves your phone' : 'On-device recognition · no internet used'}
        </Text>
      </View>
    );
  }

  const recognised = fields.filter((f) => f.status === 'recognized').length;
  const missing = fields.filter((f) => f.status === 'missing').length;
  const nextExtra = `Page ${pages.filter((p) => /^Page \d+$/.test(p.label)).length + 1}`;

  return (
    <Screen
      footer={<Button title="Encrypt & save" icon="lock-closed" onPress={save} />}
    >
      <Header title={`Review ${docType.label.toLowerCase()}`} subtitle={category?.name} />

      {extraction?.source === 'mrz' || extraction?.source === 'barcode' ? (
        <Notice tone="success" title={extraction.verified ? 'Read and verified' : 'Read automatically'}>
          {extraction.source === 'mrz'
            ? 'Details were read from the machine-readable zone' + (extraction.verified ? ' and all check digits are valid.' : '. Please check them.')
            : 'Details were read from the boarding-pass barcode.'}
        </Notice>
      ) : recognised > 0 ? (
        <Notice tone="info" title={`${recognised} detail${recognised === 1 ? '' : 's'} recognised`}>
          Please check them. Anything that could not be read is marked “Not recognised” and left empty.
        </Notice>
      ) : (
        <Notice tone="warning" title="No details recognised">
          {isNativeSecurityAvailable
            ? 'The text could not be read clearly. You can retake the photo, type the details, or save the document as it is.'
            : 'On-device recognition is not available in this build. You can type the details or save as it is.'}
        </Notice>
      )}

      <SectionTitle>Captured</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {pages.map((p) => (
          <View key={p.label} style={styles.thumbWrap}>
            {p.base64 && p.mimeType.startsWith('image/') ? (
              <Image source={{ uri: `data:${p.mimeType};base64,${p.base64}` }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="document-attach-outline" size={32} color={colors.primaryBright} />
                <Text style={[type.caption, { marginTop: 4 }]}>{p.size ? formatBytes(p.size) : 'File'}</Text>
              </View>
            )}
            <Text style={[type.caption, { marginTop: 6, color: colors.text }]}>{p.label}</Text>
            <Pressable
              onPress={() => {
                setCameraLabel(p.label);
                setPhase('camera');
              }}
              accessibilityRole="button"
              accessibilityLabel={`Retake ${p.label}`}
            >
              <Text style={[type.caption, { color: colors.primaryBright, marginTop: 2 }]}>Retake</Text>
            </Pressable>
          </View>
        ))}
        {docType.slots
          .filter((s) => !pages.some((p) => p.label === s))
          .map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setCameraLabel(s);
                setPhase('camera');
              }}
              style={[styles.thumbWrap]}
              accessibilityRole="button"
            >
              <View style={[styles.thumb, styles.addThumb]}>
                <Ionicons name="add" size={28} color={colors.primaryBright} />
              </View>
              <Text style={[type.caption, { marginTop: 6 }]}>Add {s.toLowerCase()}</Text>
            </Pressable>
          ))}
        {docType.multiPage ? (
          <Pressable
            onPress={() => {
              setCameraLabel(nextExtra === docType.slots[0] ? 'Page 2' : nextExtra);
              setPhase('camera');
            }}
            style={styles.thumbWrap}
            accessibilityRole="button"
          >
            <View style={[styles.thumb, styles.addThumb]}>
              <Ionicons name="add" size={28} color={colors.primaryBright} />
            </View>
            <Text style={[type.caption, { marginTop: 6 }]}>Add page</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <Pressable onPress={() => importInstead(pages.length ? nextExtra : docType.slots[0])} accessibilityRole="button">
        <Text style={[type.caption, { color: colors.primaryBright, marginTop: spacing.sm }]}>Import a file or photo instead…</Text>
      </Pressable>

      <SectionTitle>Document</SectionTitle>
      <TextField
        label={isCustom ? 'Name your document' : 'Name'}
        value={name}
        onChangeText={setName}
        placeholder={isCustom ? 'e.g. Car insurance' : docType.label}
        maxLength={80}
      />
      <ExpiryField
        label={categoryId === 'travel' ? 'Travel date (for reminders)' : 'Expiry date (for reminders)'}
        value={keyDate}
        onChange={setKeyDate}
      />
      <View style={styles.desc}>
        <Ionicons name="sparkles-outline" size={16} color={colors.primaryBright} />
        <Text style={[type.bodySecondary, { flex: 1, marginLeft: spacing.sm }]}>{description}</Text>
      </View>

      {fields.length ? (
        <>
          <SectionTitle>
            {`Recognised details${missing ? ` · ${missing} not recognised` : ''}`}
          </SectionTitle>
          <FieldEditor fields={fields} onChange={setFields} />
        </>
      ) : null}

      <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={1000} placeholder="Private notes, encrypted" />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Notice tone="success" title="Private by design">
        Images and details are encrypted with AES-256-GCM on this device. Recognition ran on this phone; nothing was
        uploaded.
      </Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flip: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  flipCard: {
    width: 200,
    height: 126,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWrap: { width: 112, marginRight: spacing.md, alignItems: 'center' },
  thumb: { width: 112, height: 80, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  addThumb: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: colors.primaryBorder },
  desc: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
});
