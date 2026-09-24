import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useCreateHealthRecord } from '@/hooks/use-records';
import { getErrorMessage } from '@/services/errors';
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
  // A scanned document supplies its own date when it could be read; otherwise
  // default to today. Either way the user can change it before saving.
  const [date, setDate] = useState(
    draftDate && !Number.isNaN(Date.parse(draftDate)) ? new Date(draftDate) : new Date(),
  );
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [error, setError] = useState<string | null>(null);

  const hasValue = type === 'weight' || type === 'lab_result';

  async function onSave() {
    setError(null);

    let numericValue: number | undefined;
    if (hasValue && value.trim()) {
      // Accept a decimal comma ("12,5") as typed on many keyboards.
      numericValue = Number(value.trim().replace(',', '.'));
      if (!Number.isFinite(numericValue)) {
        setError('Value must be a number, for example 12.5');
        return;
      }
    }

    try {
      await createRecord.mutateAsync({
        type,
        title: title.trim(),
        date: date.toISOString(),
        value: numericValue,
        unit: hasValue ? unit.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the record. Please try again."));
    }
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Annual checkup"
        maxLength={200}
        accessibilityLabel="Record title"
      />

      <Text style={styles.label}>Date</Text>
      {Platform.OS === 'android' && !showPicker ? (
        <Pressable
          style={styles.input}
          onPress={() => setShowPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Record date, ${date.toLocaleDateString()}. Tap to change`}>
          <Text>{date.toLocaleDateString()}</Text>
        </Pressable>
      ) : null}
      {showPicker ? (
        <DateTimePicker
          value={date}
          mode="date"
          onChange={(_, picked) => {
            if (Platform.OS === 'android') setShowPicker(false);
            if (picked) setDate(picked);
          }}
        />
      ) : null}

      {hasValue ? (
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
        maxLength={2000}
        accessibilityLabel="Notes"
      />

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
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
  error: { color: '#d33', fontSize: 14, marginTop: 12 },
  saveButton: { backgroundColor: '#208AEF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 28 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
