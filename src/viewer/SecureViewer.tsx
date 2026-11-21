import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { b64 } from '../crypto/base64';
import { fromUtf8 } from '../crypto/core';
import { colors, spacing, type } from '../theme/theme';
import { pdfHtml } from './viewerHtml';
import { t } from '../i18n';
import { ZoomableImage } from './ZoomableImage';

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

// pdf.js is bundled as text assets (not in the JS bundle) and read only when a PDF is opened.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFJS_LIB_ASSET = require('../../assets/pdfjs/pdf.txt');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFJS_WORKER_ASSET = require('../../assets/pdfjs/pdf.worker.txt');

let pdfjsCache: Promise<{ lib: string; worker: string }> | null = null;

async function readAssetText(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync(); // copies from the app package; no network involved
  return new File(asset.localUri ?? asset.uri).text();
}

function loadPdfJs() {
  if (!pdfjsCache) {
    const encode = (src: string) => JSON.stringify(src).replace(/<\//g, '<\\/');
    pdfjsCache = Promise.all([readAssetText(PDFJS_LIB_ASSET), readAssetText(PDFJS_WORKER_ASSET)])
      .then(([lib, worker]) => ({ lib: encode(lib), worker: encode(worker) }))
      .catch((e) => {
        pdfjsCache = null;
        throw e;
      });
  }
  return pdfjsCache;
}

/**
 * Renders decrypted bytes entirely in memory inside a locked-down WebView:
 * incognito, no cache, no file access, no storage, no navigation, no network
 * (CSP). Pinch-to-zoom is supported for images and PDFs.
 */
export function SecureViewer({ base64, mimeType, rotation = 0 }: { base64: string; mimeType: string; rotation?: number }) {
  const [state, setState] = useState<{ loading: boolean; error?: string }>({ loading: true });

  const [html, setHtml] = useState<string | null>(null);
  const isPdf = mimeType.toLowerCase() === 'application/pdf';
  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    loadPdfJs()
      .then(({ lib, worker }) => !cancelled && setHtml(pdfHtml(base64, lib, worker)))
      .catch(() => !cancelled && setState({ loading: false, error: 'The PDF viewer could not be loaded.' }));
    return () => {
      cancelled = true;
      setHtml(null);
    };
  }, [base64, isPdf]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type: string; message?: string };
      if (m.type === 'loaded') setState({ loading: false });
      if (m.type === 'error') setState({ loading: false, error: m.message });
    } catch {
      // ignore malformed messages
    }
  }

  const mime = mimeType.toLowerCase();
  // Images and text are shown natively (no web view); only PDFs need pdf.js.
  if (mime.startsWith('image/')) {
    return (
      <View style={{ flex: 1 }}>
        <ZoomableImage base64={base64} mimeType={mime} rotation={rotation} onError={() => setState({ loading: false, error: t('This image format cannot be displayed on this device.') })} />
        {state.error ? (
          <View style={styles.errorBar}>
            <Text style={[type.caption, { color: colors.warning }]}>{state.error}</Text>
          </View>
        ) : null}
      </View>
    );
  }
  if (mime === 'text/plain') {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={[type.body, { fontFamily: 'monospace' }]} selectable={false}>
          {fromUtf8(b64.decode(base64))}
        </Text>
      </ScrollView>
    );
  }

  if (isPdf && !html) {
    return (
      <View style={styles.center}>
        {state.error ? (
          <Text style={[type.bodySecondary, { color: colors.warning }]}>{state.error}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} size="large" />
        )}
      </View>
    );
  }

  if (!html) {
    return (
      <View style={styles.center}>
        <Text style={[type.h3, { textAlign: 'center' }]}>{t('Preview not available')}</Text>
        <Text style={[type.bodySecondary, { textAlign: 'center', marginTop: spacing.sm }]}>
          {t('This file type ({type}) is stored securely, but it cannot be displayed inside Docsave. Use Export to open it in another app.', { type: mimeType })}
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
        cacheEnabled={false}
        domStorageEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        geolocationEnabled={false}
        setSupportMultipleWindows={false}
        mixedContentMode="never"
        webviewDebuggingEnabled={false}
        style={{ backgroundColor: colors.bg }}
        containerStyle={{ backgroundColor: colors.bg }}
        onError={() => setState({ loading: false, error: t('Viewer error') })}
      />
      {state.loading ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.bg }]} pointerEvents="none">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[type.caption, { marginTop: spacing.md }]}>{t('Decrypting in memory…')}</Text>
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
