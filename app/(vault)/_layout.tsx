import { Stack } from 'expo-router';
import React from 'react';
import { colors } from '../../src/theme/theme';

export default function VaultLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="add" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
