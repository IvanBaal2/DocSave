import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { b64 } from '../crypto/base64';
import { fromUtf8 } from '../crypto/core';
import { colors, spacing, type } from '../theme/theme';
import { imageHtml, pdfHtml, textHtml } from './viewerHtml';

export const VIEWABLE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'text/plain',
];

export function isViewable(mime: string): boolean {
  return VIEWABLE_TYPES.includes(mime.toLowerCase());
}

let pdfjsCache: { lib: string; worker: string } | null = null;
function loadPdfJs() {
  if (!pdfjsCache) {
    // Lazily required so the 1.8 MB bundle is only parsed when a PDF is opened.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('./pdfjsSource.generated') as typeof import('./pdfjsSource.generated');
    pdfjsCache = { lib: JSON.stringify(m.PDFJS_LIB).replace(/<\//g, '<\\/'), worker: JSON.stringify(m.PDFJS_WORKER).replace(/<\//g, '<\\/') };
  }
  return pdfjsCache;
}

/**
 * Renders decrypted bytes entirely in memory inside a locked-down WebView:
 * incognito, no cache, no file access, no storage, no navigation, no network
 * (CSP). Pinch-to-zoom is supported for images and PDFs.
 */
export function SecureViewer({ base64, mimeType }: { base64: string; mimeType: string }) {
  const [state, setState] = useState<{ loading: boolean; error?: string }>({ loading: true });

  const html = useMemo(() => {
    const mime = mimeType.toLowerCase();
    if (mime === 'application/pdf') {
      const { lib, worker } = loadPdfJs();
      return pdfHtml(base64, lib, worker);
    }
    if (mime.startsWith('image/')) return imageHtml(base64, mime);
    if (mime === 'text/plain') return textHtml(fromUtf8(b64.decode(base64)));
    return null;
  }, [base64, mimeType]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type: string; message?: string };
      if (m.type === 'loaded') setState({ loading: false });
      if (m.type === 'error') setState({ loading: false, error: m.message });
    } catch {
      // ignore malformed messages
    }
  }

  if (!html) {
    return (
      <View style={styles.center}>
        <Text style={[type.h3, { textAlign: 'center' }]}>Preview not available</Text>
        <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm }]}>
          This file type ({mimeType}) is stored securely, but it cannot be displayed inside Docsave without
          creating an unencrypted copy.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ html }}
        originWhitelist={['about:blank', 'about:srcdoc', 'data:*', 'blob:*']}
        onShouldStartLoadWithRequest={(req) => /^(about:|data:|blob:)/.test(req.url)}
        onMessage={onMessage}
        javaScriptEnabled
        incognito
        cacheEnabled={false}
        cacheMode="LOAD_NO_CACHE"
        domStorageEnabled={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        geolocationEnabled={false}
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        mixedContentMode="never"
        saveFormDataDisabled
        allowsLinkPreview={false}
        allowsBackForwardNavigationGestures={false}
        dataDetectorTypes="none"
        textInteractionEnabled={false}
        webviewDebuggingEnabled={false}
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback={false}
        scalesPageToFit
        bounces={false}
        overScrollMode="never"
        style={{ backgroundColor: colors.bg }}
        containerStyle={{ backgroundColor: colors.bg }}
        onError={() => setState({ loading: false, error: 'Viewer error' })}
      />
      {state.loading ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.bg }]} pointerEvents="none">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[type.caption, { marginTop: spacing.md }]}>Decrypting in memory…</Text>
        </View>
      ) : null}
      {state.error ? (
        <View style={styles.errorBar}>
          <Text style={[type.caption, { color: colors.warning }]}>{state.error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorBar: { padding: spacing.md, backgroundColor: colors.warningSoft },
});
