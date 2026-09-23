import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useCreateHealthRecord } from '@/hooks/use-records';
import type { HealthRecordType } from '@/types';

const TYPES: HealthRecordType[] = [
  'weight',
  'vaccination',
  'medication',
  'vet_visit',
  'symptom',
  'lab_result',
  'note',
];

type DraftParams = {
  id: string;
  draftType?: HealthRecordType;
  draftTitle?: string;
  draftDate?: string;
  draftValue?: string;
  draftUnit?: string;
  draftNotes?: string;
  draftConfidence?: string;
};

export default function AddRecordScreen() {
  const { id, draftType, draftTitle, draftDate, draftValue, draftUnit, draftNotes, draftConfidence } =
    useLocalSearchParams<DraftParams>();
  const createRecord = useCreateHealthRecord(id);
  const isFromScan = Boolean(draftType);

  const [type, setType] = useState<HealthRecordType>(draftType ?? 'note');
  const [title, setTitle] = useState(draftTitle ?? '');
  const [value, setValue] = useState(draftValue ?? '');
  const [unit, setUnit] = useState(draftUnit ?? '');
  const [notes, setNotes] = useState(draftNotes ?? '');

  async function onSave() {
    await createRecord.mutateAsync({
      type,
      title: title.trim(),
      date: draftDate && !Number.isNaN(Date.parse(draftDate)) ? draftDate : new Date().toISOString(),
      value: value ? Number(value) : undefined,
      unit: unit.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    router.back();
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      {isFromScan ? (
        <View style={styles.scanBanner}>
          <Text style={styles.scanBannerText}>
            Extracted from a scanned document ({draftConfidence ?? 'unknown'} confidence). Review
            every field below before saving — nothing has been saved yet.
          </Text>
        </View>
      ) : null}

      <Text style={styles.label}>Type</Text>
      <View style={styles.typeRow}>
        {TYPES.map((t) => (
          <Pressable
            key={t}
            style={[styles.typeChip, type === t && styles.typeChipActive]}
            onPress={() => setType(t)}>
            <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
              {t.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Annual checkup" />

      {type === 'weight' || type === 'lab_result' ? (
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Value</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="12.5"
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Unit</Text>
            <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="kg" />
          </View>
        </View>
      ) : null}

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Optional details"
      />

      <Pressable
        style={[styles.saveButton, (!title.trim() || createRecord.isPending) && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={!title.trim() || createRecord.isPending}>
        {createRecord.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Record</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 6, paddingBottom: 40 },
  scanBanner: { backgroundColor: '#FFF4E5', borderRadius: 10, padding: 12, marginBottom: 8 },
  scanBannerText: { fontSize: 13, color: '#8a5a00', lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#f0f0f0' },
  typeChipActive: { backgroundColor: '#208AEF' },
  typeChipText: { fontSize: 13, color: '#444', textTransform: 'capitalize' },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },
  saveButton: { backgroundColor: '#208AEF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 28 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
