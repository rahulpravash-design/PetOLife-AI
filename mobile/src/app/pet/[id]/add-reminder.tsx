import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useCreateReminder } from '@/hooks/use-reminders';
import { scheduleReminderNotification } from '@/services/notifications';

export default function AddReminderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const createReminder = useCreateReminder(id);

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [notes, setNotes] = useState('');

  async function onSave() {
    const reminder = await createReminder.mutateAsync({
      title: title.trim(),
      dueDate: dueDate.toISOString(),
      notes: notes.trim() || undefined,
    });
    await scheduleReminderNotification(reminder.id, reminder.title, reminder.dueDate);
    router.back();
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Heartworm medication" />

      <Text style={styles.label}>Due date</Text>
      {Platform.OS === 'android' && !showPicker ? (
        <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
          <Text>{dueDate.toLocaleDateString()}</Text>
        </Pressable>
      ) : null}
      {showPicker ? (
        <DateTimePicker
          value={dueDate}
          mode="date"
          onChange={(_, date) => {
            if (Platform.OS === 'android') setShowPicker(false);
            if (date) setDueDate(date);
          }}
        />
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
        style={[styles.saveButton, (!title.trim() || createReminder.isPending) && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={!title.trim() || createReminder.isPending}>
        {createReminder.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Reminder</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 6, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  saveButton: { backgroundColor: '#208AEF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 28 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
