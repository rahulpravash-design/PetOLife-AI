import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useCreateReminder } from '@/hooks/use-reminders';
import { getErrorMessage } from '@/services/errors';
import { scheduleReminderNotification } from '@/services/notifications';

// The picker only chooses a day, so reminders fire at a fixed, predictable
// time on that day instead of whatever time it happened to be when created.
const REMINDER_HOUR = 9;

export default function AddReminderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const createReminder = useCreateReminder(id);

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);

    const due = new Date(dueDate);
    due.setHours(REMINDER_HOUR, 0, 0, 0);

    let reminder;
    try {
      reminder = await createReminder.mutateAsync({
        title: title.trim(),
        dueDate: due.toISOString(),
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the reminder. Please try again."));
      return;
    }

    // The reminder is already saved; a notification problem must not look like
    // a failed save, but the user should know why they won't be alerted.
    let notice: string | null = null;
    try {
      const scheduled = await scheduleReminderNotification(reminder.id, reminder.title, reminder.dueDate);
      if (!scheduled) {
        notice =
          due.getTime() <= Date.now()
            ? 'That time has already passed, so no notification was scheduled.'
            : 'Notifications are turned off for PetOLife. Turn them on in your phone settings to be alerted.';
      }
    } catch {
      notice = "The reminder was saved, but the notification couldn't be scheduled.";
    }

    if (notice) {
      Alert.alert('Reminder saved', notice, [{ text: 'OK', onPress: () => router.back() }]);
    } else {
      router.back();
    }
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Heartworm medication"
        maxLength={200}
        accessibilityLabel="Reminder title"
      />

      <Text style={styles.label}>Due date (reminds at {REMINDER_HOUR}:00 AM)</Text>
      {Platform.OS === 'android' && !showPicker ? (
        <Pressable
          style={styles.input}
          onPress={() => setShowPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Due date, ${dueDate.toLocaleDateString()}. Tap to change`}>
          <Text>{dueDate.toLocaleDateString()}</Text>
        </Pressable>
      ) : null}
      {showPicker ? (
        <DateTimePicker
          value={dueDate}
          mode="date"
          minimumDate={new Date()}
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
  error: { color: '#d33', fontSize: 14, marginTop: 12 },
  saveButton: { backgroundColor: '#208AEF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 28 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
