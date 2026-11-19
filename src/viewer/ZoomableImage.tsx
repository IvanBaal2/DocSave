import React, { useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

const MAX_SCALE = 5;

const distance = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
};

/**
 * Native image viewer with pinch-to-zoom, drag and double-tap. The image is a
 * data URI decoded in memory only (no file, no web view).
 */
export function ZoomableImage({ base64, mimeType, onError }: { base64: string; mimeType: string; onError?: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const state = useRef({ scale: 1, x: 0, y: 0, startScale: 1, startDist: 0, startX: 0, startY: 0, lastTap: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  const uri = useMemo(() => `data:${mimeType};base64,${base64}`, [base64, mimeType]);

  const clampPan = (x: number, y: number, s: number) => {
    const mx = (size.w * (s - 1)) / 2;
    const my = (size.h * (s - 1)) / 2;
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };

  const apply = (s: number, x: number, y: number, animate = false) => {
    const c = clampPan(x, y, s);
    state.current.scale = s;
    state.current.x = c.x;
    state.current.y = c.y;
    if (animate) {
      Animated.parallel([
        Animated.spring(scale, { toValue: s, useNativeDriver: true }),
        Animated.spring(tx, { toValue: c.x, useNativeDriver: true }),
        Animated.spring(ty, { toValue: c.y, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(s);
      tx.setValue(c.x);
      ty.setValue(c.y);
    }
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => state.current.scale > 1 || Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        onPanResponderGrant: (e) => {
          const st = state.current;
          st.startScale = st.scale;
          st.startX = st.x;
          st.startY = st.y;
          st.startDist = distance(e);
          const now = Date.now();
          if (e.nativeEvent.touches.length === 1 && now - st.lastTap < 280) {
            // double tap: zoom in / reset
            apply(st.scale > 1 ? 1 : 2.5, 0, 0, true);
            st.lastTap = 0;
          } else {
            st.lastTap = now;
          }
        },
        onPanResponderMove: (e, g) => {
          const st = state.current;
          if (e.nativeEvent.touches.length >= 2) {
            const d = distance(e);
            if (!st.startDist) {
              st.startDist = d;
              st.startScale = st.scale;
              return;
            }
            const s = Math.max(1, Math.min(MAX_SCALE, (st.startScale * d) / st.startDist));
            apply(s, st.x, st.y);
          } else if (st.scale > 1) {
            apply(st.scale, st.startX + g.dx, st.startY + g.dy);
          }
        },
        onPanResponderRelease: () => {
          const st = state.current;
          st.startDist = 0;
          if (st.scale < 1.05) apply(1, 0, 0, true);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [size.w, size.h],
  );

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={styles.root} onLayout={onLayout} {...responder.panHandlers}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          fadeDuration={0}
          onError={onError}
          accessibilityIgnoresInvertColors
          accessibilityLabel="Document image. Pinch or double-tap to zoom."
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
});
