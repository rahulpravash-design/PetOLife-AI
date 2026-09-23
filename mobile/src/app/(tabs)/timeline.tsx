import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePets } from '@/hooks/use-pets';
import { useHealthRecords } from '@/hooks/use-records';
import type { HealthRecord } from '@/types';

const TYPE_LABEL: Record<HealthRecord['type'], string> = {
  weight: 'Weight',
  vaccination: 'Vaccination',
  medication: 'Medication',
  vet_visit: 'Vet Visit',
  symptom: 'Symptom',
  lab_result: 'Lab Result',
  note: 'Note',
};

function RecordRow({ record }: { record: HealthRecord }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowDot} />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowType}>{TYPE_LABEL[record.type]}</Text>
          <Text style={styles.rowDate}>{new Date(record.date).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.rowTitle}>{record.title}</Text>
        {record.value != null ? (
          <Text style={styles.rowValue}>
            {record.value} {record.unit}
          </Text>
        ) : null}
        {record.notes ? <Text style={styles.rowNotes}>{record.notes}</Text> : null}
      </View>
    </View>
  );
}

export default function TimelineScreen() {
  const { data: pets } = usePets();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const activePetId = selectedPetId ?? pets?.[0]?.id ?? null;

  const { data: records, isLoading, refetch, isRefetching } = useHealthRecords(activePetId ?? '');
  const sorted = [...(records ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Timeline</Text>

      {pets && pets.length > 1 ? (
        <View style={styles.chips}>
          {pets.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.chip, activePetId === p.id && styles.chipActive]}
              onPress={() => setSelectedPetId(p.id)}>
              <Text style={[styles.chipText, activePetId === p.id && styles.chipTextActive]}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={styles.center} />
      ) : !activePetId ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Add a pet to see their health timeline.</Text>
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No records yet for this pet.</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RecordRow record={item} />}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', paddingHorizontal: 20, paddingTop: 8 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  chipActive: { backgroundColor: '#208AEF' },
  chipText: { fontSize: 14, color: '#444' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#666', fontSize: 15 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  rowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#208AEF', marginTop: 6 },
  rowBody: { flex: 1 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  rowType: { fontSize: 12, color: '#208AEF', fontWeight: '700', textTransform: 'uppercase' },
  rowDate: { fontSize: 12, color: '#999' },
  rowTitle: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  rowValue: { fontSize: 14, color: '#444', marginTop: 2 },
  rowNotes: { fontSize: 14, color: '#777', marginTop: 4 },
});
