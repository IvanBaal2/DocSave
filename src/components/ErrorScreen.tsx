import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, type } from '../theme/theme';
import { Button } from './ui';
import { t, useI18n } from '../i18n';

/** Shown instead of crashing when a screen throws. Contains no document data. */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => void }) {
  const { direction } = useI18n();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, direction }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={56} color={colors.warning} style={{ marginTop: spacing.xxl }} />
        <Text style={[type.h1, { marginTop: spacing.lg, textAlign: 'center' }]}>{t('Something went wrong')}</Text>
        <Text style={[type.bodySecondary, { marginTop: spacing.sm, textAlign: 'center' }]}>
          {t('Your vault is safe, nothing was lost. Please try again. If it keeps happening, send this message to support:')}
        </Text>
        <View style={{ alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginTop: spacing.lg }}>
          <Text style={[type.caption, { fontFamily: 'monospace', color: colors.textSecondary }]} selectable>
            {String(error?.message ?? error).slice(0, 600)}
          </Text>
        </View>
        <Button title={t('Try again')} icon="refresh" onPress={retry} style={{ alignSelf: 'stretch', marginTop: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

let installed = false;

/**
 * Release builds close the app on an unhandled JavaScript error. Show the
 * message instead so problems can be reported (the message never contains
 * document content: errors are thrown by code, not built from user data).
 */
export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (e: unknown, isFatal?: boolean) => void;
      setGlobalHandler: (h: (e: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const previous = eu.getGlobalHandler();
  eu.setGlobalHandler((e, isFatal) => {
    if (__DEV__) return previous(e, isFatal);
    const msg = String((e as Error)?.message ?? e).slice(0, 400);
    Alert.alert(t('Something went wrong'), `${t('Your vault is safe. Please try again.')}\n\n${msg}`);
  });
}
