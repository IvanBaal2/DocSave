import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cropJpeg, isNativeSecurityAvailable, recognizeText } from '../../modules/docsave-security';
import { FRAME_ASPECT, assessSnapshot, screenRectToPhoto, type Rect } from '../scan/capture';
import { parseBcbp } from '../scan/extract';
import { deleteTempFile } from '../security/secureTemp';
import { colors, spacing, type } from '../theme/theme';
import type { DocTypeDef } from '../vault/categories';
import { useVault } from '../vault/VaultContext';
import { Button, haptic } from './ui';

export type CapturedSide = { base64: string; lines: string[]; barcode?: string; ocrError?: string };

/** Chooses a photo size that is sharp enough for documents but fast to capture and analyse. */
function choosePictureSize(sizes: string[]): string | undefined {
  const parsed = sizes
    .map((s) => {
      const m = /^(\d+)x(\d+)$/.exec(s);
      return m ? { s, w: +m[1], h: +m[2] } : null;
    })
    .filter((x): x is { s: string; w: number; h: number } => !!x);
  const fit = parsed.filter((p) => Math.max(p.w, p.h) <= 3264 && Math.max(p.w, p.h) >= 1600);
  fit.sort((a, b) => b.w * b.h - a.w * a.h);
  return fit[0]?.s;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BARCODE_TYPES = ['pdf417', 'aztec', 'qr', 'datamatrix'] as const;

/**
 * Full-screen guided camera with automatic capture.
 *
 * Small preview snapshots are cropped to the guide frame and analysed with
 * on-device OCR (ML Kit / Apple Vision). When the expected content is found,
 * a full-quality photo is taken, cropped to the document and returned in
 * memory. Every temporary camera file is deleted immediately.
 */
export function GuidedCamera({
  docType,
  sideIndex,
  stepLabel,
  stepCount,
  optional,
  onCaptured,
  onSkip,
  onImport,
  onClose,
}: {
  docType: DocTypeDef;
  sideIndex: number;
  stepLabel: string;
  stepCount: number;
  optional?: boolean;
  onCaptured: (side: CapturedSide) => void;
  onSkip?: () => void;
  onImport?: () => void;
  onClose: () => void;
}) {
  const vault = useVault();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
  const [hint, setHint] = useState('Place the document inside the frame');
  const [found, setFound] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [torch, setTorch] = useState(false);
  const [slow, setSlow] = useState(false);
  const [ocrProblem, setOcrProblem] = useState<string | null>(null);
  const [pictureSize, setPictureSize] = useState<string | undefined>();
  const capturingRef = useRef(false);
  const barcodeRef = useRef<string | undefined>(undefined);
  const pulse = useRef(new Animated.Value(0)).current;
  const autoCapture = isNativeSecurityAvailable;

  // Guide frame geometry in screen coordinates.
  const frame: Rect | null = (() => {
    if (!layout) return null;
    const aspect = FRAME_ASPECT[docType.frame];
    let w = layout.width * (docType.frame === 'document' ? 0.8 : 0.9);
    let h = w / aspect;
    const maxH = layout.height * 0.6;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    return { x: (layout.width - w) / 2, y: (layout.height - h) / 2 - layout.height * 0.03, w, h };
  })();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const captureFull = useCallback(async () => {
    if (capturingRef.current || !cam.current) return;
    capturingRef.current = true;
    setCapturing(true);
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.85, base64: true, exif: false, shutterSound: false });
      deleteTempFile(photo?.uri);
      if (!photo?.base64) throw new Error('No image');
      const f = frameRef.current;
      const l = layoutRef.current;
      const base64 =
        f && l
          ? await cropJpeg(photo.base64, screenRectToPhoto(f, l, { width: photo.width, height: photo.height }, 0.06), 0.9, 3200)
          : photo.base64;
      let lines: string[] = [];
      let ocrError: string | undefined;
      if (autoCapture) {
        try {
          lines = (await recognizeText(base64, 2400)).lines.map((x) => x.text);
        } catch (e) {
          ocrError = (e as Error)?.message || 'Text recognition failed';
        }
      }
      haptic.success();
      onCaptured({ base64, lines, barcode: barcodeRef.current, ocrError });
    } catch {
      setHint('Capture failed — try again');
      capturingRef.current = false;
      setCapturing(false);
    }
  }, [autoCapture, onCaptured]);

  // Auto-capture loop.
  useEffect(() => {
    if (!cameraReady || !permission?.granted || !autoCapture) return;
    let cancelled = false;
    let previous: string[] | null = null;
    const started = Date.now();
    (async () => {
      await sleep(700); // let exposure and focus settle
      while (!cancelled && !capturingRef.current) {
        try {
          const f = frameRef.current;
          const l = layoutRef.current;
          const snap = await cam.current?.takePictureAsync({ quality: 0.3, base64: true, exif: false, shutterSound: false });
          deleteTempFile(snap?.uri);
          if (cancelled || capturingRef.current) break;
          if (snap?.base64 && f && l) {
            const crop = await cropJpeg(snap.base64, screenRectToPhoto(f, l, { width: snap.width, height: snap.height }), 0.7, 1600);
            let lines: string[];
            try {
              lines = (await recognizeText(crop, 1600)).lines.map((x) => x.text);
              setOcrProblem(null);
            } catch (e) {
              setOcrProblem((e as Error)?.message || 'Text recognition failed');
              await sleep(1500);
              continue;
            }
            const r = assessSnapshot({ kind: docType.kind, sideIndex, lines, previousLines: previous, barcode: barcodeRef.current });
            if (cancelled) break;
            setHint(r.message);
            setFound(lines.length > 0);
            if (r.ready) {
              await captureFull();
              break;
            }
            previous = lines;
          }
        } catch {
          await sleep(600);
        }
        if (Date.now() - started > 12_000) setSlow(true);
        await sleep(250);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cameraReady, permission?.granted, autoCapture, docType.kind, sideIndex, captureFull]);

  const onBarcode = useCallback(
    (e: BarcodeScanningResult) => {
      if (barcodeRef.current || !parseBcbp(e.data)) return;
      barcodeRef.current = e.data;
      setHint('Boarding pass barcode read');
      if (autoCapture) captureFull();
    },
    [autoCapture, captureFull],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="camera-outline" size={48} color={colors.primaryBright} />
        <Text style={[type.h2, { marginTop: spacing.lg, textAlign: 'center' }]}>Camera access</Text>
        <Text style={[type.bodySecondary, { textAlign: 'center', marginVertical: spacing.md }]}>
          Docsave uses the camera only to scan your documents. Photos are read and encrypted on this device and never
          leave it.
        </Text>
        <Button
          title={permission?.canAskAgain === false ? 'Camera blocked in system settings' : 'Allow camera'}
          disabled={permission?.canAskAgain === false}
          onPress={() => vault.runExternal(requestPermission)}
          style={{ alignSelf: 'stretch', marginTop: spacing.lg }}
        />
        {onImport ? (
          <Button title="Import a file instead" variant="secondary" icon="folder-open-outline" onPress={onImport} style={{ alignSelf: 'stretch', marginTop: spacing.sm }} />
        ) : null}
        <Button title="Cancel" variant="ghost" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: spacing.sm }} />
      </SafeAreaView>
    );
  }

  const cornerColor = found ? colors.primaryBright : '#FFFFFF';
  return (
    <View style={styles.root} onLayout={onLayout}>
      <CameraView
        ref={cam}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        animateShutter={false}
        pictureSize={pictureSize}
        onCameraReady={async () => {
          try {
            const sizes = await cam.current?.getAvailablePictureSizesAsync();
            const best = sizes ? choosePictureSize(sizes) : undefined;
            if (best) setPictureSize(best);
          } catch {
            // keep the default size
          }
          setCameraReady(true);
        }}
        barcodeScannerSettings={docType.kind === 'boarding' ? { barcodeTypes: [...BARCODE_TYPES] } : undefined}
        onBarcodeScanned={docType.kind === 'boarding' ? onBarcode : undefined}
      />
      {frame ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={[styles.mask, { height: frame.y }]} />
          <View style={{ flexDirection: 'row', height: frame.h }}>
            <View style={[styles.mask, { width: frame.x }]} />
            <Animated.View
              style={{
                width: frame.w,
                height: frame.h,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
              }}
            >
              {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                <View key={c} style={[styles.corner, cornerStyle[c], { borderColor: cornerColor }]} />
              ))}
              {docType.kind === 'passport' ? (
                <View style={styles.mrzZone}>
                  <Text style={styles.mrzText}>{'P<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<'}</Text>
                  <Text style={styles.mrzText}>{'<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<'}</Text>
                </View>
              ) : null}
            </Animated.View>
            <View style={[styles.mask, { flex: 1 }]} />
          </View>
          <View style={[styles.mask, { flex: 1, alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.xl }]}>
            <View style={styles.hintPill}>
              {capturing ? <ActivityIndicator color={colors.primaryBright} size="small" /> : (
                <Ionicons name={found ? 'scan' : 'scan-outline'} size={16} color={found ? colors.primaryBright : '#fff'} />
              )}
              <Text style={[type.body, { color: '#fff', marginLeft: 8 }]}>{capturing ? 'Capturing and reading…' : hint}</Text>
            </View>
            {ocrProblem ? (
              <Text style={[type.caption, { color: colors.warning, marginTop: spacing.sm, textAlign: 'center' }]}>
                {`Automatic reading is not working on this phone (${ocrProblem}). Tap the shutter to capture.`}
              </Text>
            ) : !autoCapture ? (
              <Text style={[type.caption, { color: '#ccd', marginTop: spacing.sm, textAlign: 'center' }]}>
                Automatic capture is not available in this build. Tap the shutter when the document is sharp.
              </Text>
            ) : slow ? (
              <Text style={[type.caption, { color: '#ccd', marginTop: spacing.sm, textAlign: 'center' }]}>
                Having trouble? Improve the light, avoid glare, or tap the shutter to capture manually.
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Pressable onPress={onClose} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Close camera">
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <View style={styles.stepPill}>
          <Ionicons name="lock-closed" size={12} color={colors.primaryBright} />
          <Text style={[type.caption, { color: colors.text, marginLeft: 6 }]}>
            {docType.label} · {stepLabel}
            {stepCount > 1 ? ` (${sideIndex + 1}/${stepCount})` : ''}
          </Text>
        </View>
        <Pressable onPress={() => setTorch((t) => !t)} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Toggle flashlight">
          <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color="#fff" />
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <View style={styles.sideAction}>
          {onImport ? (
            <Pressable onPress={onImport} accessibilityRole="button" accessibilityLabel="Import a file or photo" style={styles.smallBtn}>
              <Ionicons name="images-outline" size={22} color="#fff" />
              <Text style={styles.smallLabel}>Import</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={captureFull}
          disabled={!cameraReady || capturing}
          accessibilityRole="button"
          accessibilityLabel="Capture now"
          style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          {capturing ? <ActivityIndicator color={colors.bg} /> : <View style={styles.shutterInner} />}
        </Pressable>
        <View style={styles.sideAction}>
          {optional && onSkip ? (
            <Pressable onPress={onSkip} accessibilityRole="button" accessibilityLabel="Skip this side" style={styles.smallBtn}>
              <Ionicons name="play-skip-forward-outline" size={22} color="#fff" />
              <Text style={styles.smallLabel}>Skip</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const C = 30;
const cornerStyle = StyleSheet.create({
  tl: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  mask: { backgroundColor: 'rgba(3,6,12,0.66)' },
  corner: { position: 'absolute', width: C, height: C },
  mrzZone: { position: 'absolute', left: 10, right: 10, bottom: 10, opacity: 0.35 },
  mrzText: { color: '#fff', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1 },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    maxWidth: '62%',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: spacing.xl,
  },
  sideAction: { width: 72, alignItems: 'center' },
  smallBtn: { alignItems: 'center', padding: spacing.sm },
  smallLabel: { color: '#fff', fontSize: 12, marginTop: 4 },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primaryBright },
});
