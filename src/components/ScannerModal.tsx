import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { b64 } from '../crypto/base64';
import { deleteTempFile } from '../security/secureTemp';
import { colors, radius, spacing, type } from '../theme/theme';
import { useVault } from '../vault/VaultContext';
import { Button, haptic } from './ui';

export type Frame = 'card' | 'passport' | 'document';

const ASPECT: Record<Frame, number> = {
  card: 1.586, // ID-1 (credit-card size): 85.6 × 54 mm
  passport: 1.42, // ID-3 data page: 125 × 88 mm
  document: 0.707, // A4 portrait
};

const GUIDE: Record<Frame, string> = {
  card: 'Fit the card inside the frame. Avoid glare.',
  passport: 'Place the passport page flat inside the frame.',
  document: 'Align the page edges with the frame.',
};

/**
 * Full-screen document camera. The photo is captured as JPEG in memory
 * (base64), the temporary file the camera writes is deleted immediately, and
 * the bytes are handed straight to the encryption pipeline.
 */
export function ScannerModal({
  visible,
  frame,
  slotLabel,
  onClose,
  onCapture,
}: {
  visible: boolean;
  frame: Frame;
  slotLabel?: string;
  onClose: () => void;
  onCapture: (page: { bytes: Uint8Array; mimeType: string }) => void;
}) {
  const vault = useVault();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [review, setReview] = useState<string | null>(null); // base64, memory only
  const { width } = useWindowDimensions();

  const frameW = frame === 'document' ? width * 0.72 : width * 0.86;
  const frameH = frameW / ASPECT[frame];

  async function capture() {
    if (!cam.current || busy) return;
    setBusy(true);
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.85, base64: true, exif: false, shutterSound: false });
      deleteTempFile(photo?.uri);
      if (photo?.base64) {
        haptic.success();
        setReview(photo.base64);
      }
    } finally {
      setBusy(false);
    }
  }

  function accept() {
    if (!review) return;
    onCapture({ bytes: b64.decode(review), mimeType: 'image/jpeg' });
    setReview(null);
  }

  function close() {
    setReview(null);
    setTorch(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={styles.root}>
        {!permission?.granted ? (
          <SafeAreaView style={styles.center}>
            <Ionicons name="camera-outline" size={48} color={colors.primaryBright} />
            <Text style={[type.h2, { marginTop: spacing.lg, textAlign: 'center' }]}>Camera access</Text>
            <Text style={[type.bodySecondary, { textAlign: 'center', marginVertical: spacing.md }]}>
              Docsave uses the camera only to scan documents. Photos are encrypted immediately and never leave
              this device.
            </Text>
            <Button
              title={permission?.canAskAgain === false ? 'Camera access denied in Settings' : 'Allow camera'}
              disabled={permission?.canAskAgain === false}
              onPress={() => vault.runExternal(requestPermission)}
              style={{ alignSelf: 'stretch', marginTop: spacing.lg }}
            />
            <Button title="Cancel" variant="ghost" onPress={close} style={{ alignSelf: 'stretch', marginTop: spacing.sm }} />
          </SafeAreaView>
        ) : review ? (
          <SafeAreaView style={{ flex: 1 }}>
            <Text style={[type.h2, { textAlign: 'center', marginTop: spacing.lg }]}>Check the photo</Text>
            <Text style={[type.caption, { textAlign: 'center', marginTop: 4 }]}>Make sure all text is sharp and readable</Text>
            <View style={styles.center}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${review}` }}
                style={{ width: width - 48, height: (width - 48) * 1.2, borderRadius: radius.md }}
                resizeMode="contain"
              />
            </View>
            <View style={styles.reviewBar}>
              <Button title="Retake" variant="secondary" icon="refresh" onPress={() => setReview(null)} style={{ flex: 1, marginRight: spacing.sm }} />
              <Button title="Use photo" icon="lock-closed" onPress={accept} style={{ flex: 1, marginLeft: spacing.sm }} />
            </View>
          </SafeAreaView>
        ) : (
          <>
            <CameraView
              ref={cam}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              animateShutter
              onCameraReady={() => setReady(true)}
            />
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={styles.mask} />
              <View style={{ flexDirection: 'row', height: frameH }}>
                <View style={styles.mask} />
                <View style={[styles.frame, { width: frameW, height: frameH }]}>
                  {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                    <View key={c} style={[styles.corner, cornerStyle[c]]} />
                  ))}
                </View>
                <View style={styles.mask} />
              </View>
              <View style={[styles.mask, { alignItems: 'center', paddingTop: spacing.lg }]}>
                <Text style={[type.body, { textAlign: 'center', paddingHorizontal: spacing.xl }]}>{GUIDE[frame]}</Text>
              </View>
            </View>
            <SafeAreaView style={styles.topBar} edges={['top']}>
              <Pressable onPress={close} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Close camera">
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
              <View style={styles.slotPill}>
                <Ionicons name="lock-closed" size={12} color={colors.primaryBright} />
                <Text style={[type.caption, { color: colors.text, marginLeft: 6 }]}>{slotLabel ?? 'Scan document'}</Text>
              </View>
              <Pressable onPress={() => setTorch((t) => !t)} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Toggle flashlight">
                <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color="#fff" />
              </Pressable>
            </SafeAreaView>
            <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
              <Pressable
                onPress={capture}
                disabled={!ready || busy}
                accessibilityRole="button"
                accessibilityLabel="Capture photo"
                style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                {busy ? <ActivityIndicator color={colors.bg} /> : <View style={styles.shutterInner} />}
              </Pressable>
            </SafeAreaView>
          </>
        )}
      </View>
    </Modal>
  );
}

const C = 28;
const cornerStyle = StyleSheet.create({
  tl: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  mask: { flex: 1, backgroundColor: 'rgba(3,6,12,0.62)' },
  frame: { borderRadius: 14 },
  corner: { position: 'absolute', width: C, height: C, borderColor: colors.primaryBright },
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
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: spacing.xl },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primaryBright },
  reviewBar: { flexDirection: 'row', padding: spacing.xl },
});
