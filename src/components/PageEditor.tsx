/**
 * Review step after a photo is taken: accept or retake, and optionally adjust.
 *
 *  - Four draggable corners select the page; on Accept the area is straightened
 *    (perspective correction) on the device.
 *  - "Whole photo" resets the corners so the original photo is kept unchanged.
 *  - Rotate turns the photo by 90°; "Enhance" applies mild contrast/brightness
 *    for readability (nothing is added or removed).
 *
 * The corners start on the camera guide frame. Automatic edge detection is not
 * available, so the user can drag the corners onto the page edges.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rotateJpeg, warpJpeg, type Quad } from '../../modules/docsave-security';
import { FULL_QUAD, rotateQuad } from '../scan/geometry';
import { useI18n } from '../i18n';
import { colors, fonts, radius, spacing, type } from '../theme/theme';
import { Button } from './ui';

const isFull = (q: Quad) => q.every((v, i) => Math.abs(v - FULL_QUAD[i]) < 0.005);

export function PageEditor({
  base64,
  width,
  height,
  initialQuad,
  enhanceByDefault,
  onAccept,
  onRetake,
}: {
  base64: string;
  width: number;
  height: number;
  initialQuad: Quad;
  enhanceByDefault: boolean;
  onAccept: (finalBase64: string) => void;
  onRetake: () => void;
}) {
  const { t, direction } = useI18n();
  const [image, setImage] = useState({ b64: base64, w: width, h: height });
  const [quad, setQuad] = useState<Quad>(initialQuad);
  const [enhance, setEnhance] = useState(enhanceByDefault);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState(0);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const quadRef = useRef(quad);
  quadRef.current = quad;

  // Where the photo is drawn inside the available area (contain).
  const view = useMemo(() => {
    if (!box) return null;
    const scale = Math.min(box.w / image.w, box.h / image.h);
    const w = image.w * scale;
    const h = image.h * scale;
    return { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h };
  }, [box, image.w, image.h]);
  const viewRef = useRef(view);
  viewRef.current = view;

  const responders = useMemo(
    () =>
      [0, 1, 2, 3].map((corner) => {
        let start: [number, number] = [0, 0];
        return PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            start = [quadRef.current[corner * 2], quadRef.current[corner * 2 + 1]];
          },
          onPanResponderMove: (_e, g) => {
            const v = viewRef.current;
            if (!v) return;
            const nx = Math.min(1, Math.max(0, start[0] + g.dx / v.w));
            const ny = Math.min(1, Math.max(0, start[1] + g.dy / v.h));
            setQuad((q) => {
              const next = [...q] as Quad;
              next[corner * 2] = nx;
              next[corner * 2 + 1] = ny;
              return next;
            });
          },
        });
      }),
    [],
  );

  async function rotate() {
    setBusy(true);
    try {
      const turned = await rotateJpeg(image.b64, 90);
      setImage((i) => ({ b64: turned, w: i.h, h: i.w }));
      setQuad((q) => rotateQuad(q));
      setTurns((n) => (n + 1) % 4);
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setBusy(true);
    try {
      const out = isFull(quad) && !enhance ? image.b64 : await warpJpeg(image.b64, quad, { enhance, quality: 0.9 });
      onAccept(out);
    } catch {
      // The selected shape could not be straightened: keep the photo as it is.
      onAccept(image.b64);
    }
  }

  const pts = view
    ? [0, 1, 2, 3].map((i) => ({ x: view.x + quad[i * 2] * view.w, y: view.y + quad[i * 2 + 1] * view.h }))
    : [];

  return (
    <SafeAreaView style={[styles.root, { direction }]}>
      <Text style={[type.h2, styles.title]}>{t('Check the photo')}</Text>
      <Text style={[type.caption, styles.subtitle]}>{t('Drag the corners onto the edges of the page, or keep the whole photo.')}</Text>
      <View style={styles.stage} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {view ? (
          <>
            <Image
              source={{ uri: `data:image/jpeg;base64,${image.b64}` }}
              style={{ position: 'absolute', left: view.x, top: view.y, width: view.w, height: view.h }}
              resizeMode="stretch"
              accessibilityLabel={t('Captured photo')}
            />
            {pts.map((a, i) => {
              const b = pts[(i + 1) % 4];
              const len = Math.hypot(b.x - a.x, b.y - a.y);
              const angle = Math.atan2(b.y - a.y, b.x - a.x);
              return (
                <View
                  key={`edge${i}`}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: (a.x + b.x) / 2 - len / 2,
                    top: (a.y + b.y) / 2 - 1,
                    width: len,
                    height: 2,
                    backgroundColor: colors.primaryBright,
                    transform: [{ rotate: `${angle}rad` }],
                  }}
                />
              );
            })}
            {pts.map((p, i) => (
              <View
                key={`h${i}`}
                {...responders[i].panHandlers}
                accessibilityRole="adjustable"
                accessibilityLabel={t('Corner {n}', { n: i + 1 })}
                hitSlop={16}
                style={[styles.handle, { left: p.x - 16, top: p.y - 16 }]}
              />
            ))}
          </>
        ) : null}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.primaryBright} size="large" />
          </View>
        ) : null}
      </View>

      <View style={styles.tools}>
        <Tool icon="refresh-outline" label={t('Rotate')} state={turns ? `${turns * 90}°` : t('Upright')} onPress={rotate} disabled={busy} active={turns > 0} />
        <Tool
          icon="scan-outline"
          label={t('Whole photo')}
          state={isFull(quad) ? t('Original kept') : t('Cropped')}
          onPress={() => {
            if (!isFull(quad)) return setQuad(FULL_QUAD);
            let q = initialQuad;
            for (let i = 0; i < turns; i++) q = rotateQuad(q);
            setQuad(q);
          }}
          disabled={busy}
          active={isFull(quad)}
        />
        <Tool icon="sunny-outline" label={t('Enhance')} state={enhance ? t('On') : t('Off')} onPress={() => setEnhance((v) => !v)} disabled={busy} active={enhance} />
      </View>
      <View style={styles.actions}>
        <Button title={t('Retake')} variant="secondary" icon="camera-reverse-outline" onPress={onRetake} disabled={busy} style={{ flex: 1 }} />
        <View style={{ width: spacing.md }} />
        <Button title={t('Use photo')} icon="checkmark" onPress={accept} loading={busy} style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

function Tool({
  icon,
  label,
  state,
  onPress,
  disabled,
  active,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  state: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${state}`}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      style={[styles.tool, active && { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft }]}
    >
      <Ionicons name={icon} size={20} color={active ? colors.primaryBright : colors.text} />
      <Text style={[type.caption, { marginTop: 4, fontFamily: fonts.semibold, color: active ? colors.primaryBright : colors.text }]}>{label}</Text>
      <Text style={[type.caption, { fontSize: 12 }]}>{state}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { textAlign: 'center', marginTop: spacing.md },
  subtitle: { textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.xl },
  stage: { flex: 1, margin: spacing.lg, direction: 'ltr' },
  handle: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.primaryBright,
    backgroundColor: 'rgba(5,8,15,0.55)',
  },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,8,15,0.45)' },
  tools: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: spacing.lg },
  tool: {
    alignItems: 'center',
    minWidth: 92,
    marginHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: { flexDirection: 'row', padding: spacing.lg },
});
