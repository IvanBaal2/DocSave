import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { DocumentCard } from '../../../src/components/DocumentCard';
import { Button, Chip, EmptyState, Header, IconButton, Screen, type IconName } from '../../../src/components/ui';
import { colors, spacing, type } from '../../../src/theme/theme';
import { findCategory } from '../../../src/vault/categories';
import { useVault } from '../../../src/vault/VaultContext';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { index } = useVault();
  const [docType, setDocType] = useState<string | null>(null);
  const cat = findCategory(id, index.customCategories);

  if (!cat) {
    return (
      <Screen>
        <Header title="Not found" />
        <EmptyState icon="folder-open-outline" title="Category not found" body="It may have been deleted." />
      </Screen>
    );
  }

  const docs = index.documents
    .filter((d) => d.categoryId === cat.id)
    .filter((d) => !docType || d.docType === docType)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Screen
      footer={
        <Button
          title={`Add to ${cat.name.replace(' Documents', '')}`}
          icon="add"
          onPress={() => router.push({ pathname: '/add', params: { categoryId: cat.id, docType: docType ?? '' } })}
        />
      }
    >
      <Header
        title={cat.name}
        subtitle={`${docs.length} encrypted ${docs.length === 1 ? 'document' : 'documents'}`}
        right={
          <IconButton icon="search" accessibilityLabel="Search" onPress={() => router.push('/search')} />
        }
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: cat.color + '1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={cat.icon as IconName} size={26} color={cat.color} />
        </View>
        <Text style={[type.bodySecondary, { marginLeft: spacing.lg, flex: 1 }]}>{cat.description}</Text>
      </View>
      {cat.types.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <Chip label="All" selected={!docType} onPress={() => setDocType(null)} />
          {cat.types.map((t) => (
            <Chip key={t.id} label={t.label} selected={docType === t.id} onPress={() => setDocType(t.id)} />
          ))}
        </ScrollView>
      ) : null}
      {docs.length === 0 ? (
        <EmptyState
          icon="document-lock-outline"
          title="Nothing here yet"
          body="Documents you add here are encrypted with AES-256-GCM before being saved."
        />
      ) : (
        docs.map((d) => (
          <DocumentCard
            key={d.id}
            doc={d}
            custom={index.customCategories}
            onPress={() => router.push({ pathname: '/document/[id]', params: { id: d.id } })}
          />
        ))
      )}
      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg, color: colors.textMuted }]}>
        Names and notes are also encrypted.
      </Text>
    </Screen>
  );
}
