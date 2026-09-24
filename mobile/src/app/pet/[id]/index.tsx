import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useDeletePet, usePet } from '@/hooks/use-pets';
import { useDeleteReminder, useReminders, useToggleReminder } from '@/hooks/use-reminders';
import { useHealthSummary } from '@/hooks/use-summary';
import { getErrorMessage } from '@/services/errors';
import { cancelReminderNotification, scheduleReminderNotification } from '@/services/notifications';
import type { AttentionItem, Pattern, Reminder, WhatChanged } from '@/types';

function ChangedRow({ item }: { item: WhatChanged }) {
  const up = item.deltaAbsolute > 0;
  return (
    <View style={styles.changeRow}>
      <Text style={styles.changeMetric}>{item.metric}</Text>
      <Text style={[styles.changeDelta, up ? styles.changeUp : styles.changeDown]}>
        {up ? '+' : ''}
        {item.deltaAbsolute} ({up ? '+' : ''}
        {item.deltaPercent.toFixed(1)}%)
      </Text>
    </View>
  );
}

function ExplainableCard({
  title,
  reasoning,
}: {
  title: string;
  reasoning: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.card}>
      <Text style={styles.cardText}>{title}</Text>
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.whyLink}>{expanded ? 'Hide reasoning' : 'Why am I seeing this?'}</Text>
      </Pressable>
      {expanded ? <Text style={styles.reasoning}>{reasoning}</Text> : null}
    </View>
  );
}

function ReminderRow({
  reminder,
  onToggle,
  onDelete,
}: {
  reminder: Reminder;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      style={styles.reminderRow}
      onPress={onToggle}
      onLongPress={onDelete}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: reminder.isDone }}
      accessibilityLabel={`${reminder.title}, due ${new Date(reminder.dueDate).toLocaleDateString()}`}
      accessibilityHint="Double tap to mark done. Press and hold to delete.">
      <View style={[styles.reminderCheckbox, reminder.isDone && styles.reminderCheckboxDone]}>
        {reminder.isDone ? <Text style={styles.reminderCheckmark}>✓</Text> : null}
      </View>
      <View style={styles.reminderBody}>
        <Text style={[styles.reminderTitle, reminder.isDone && styles.reminderTitleDone]}>
          {reminder.title}
        </Text>
        <Text style={styles.reminderDate}>{new Date(reminder.dueDate).toLocaleDateString()}</Text>
      </View>
    </Pressable>
  );
}

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: pet } = usePet(id);
  const {
    data: summary,
    isLoading,
    isError,
    error: summaryError,
    refetch: refetchSummary,
    isRefetching: isRefetchingSummary,
  } = useHealthSummary(id);
  const { data: reminders, refetch: refetchReminders } = useReminders(id);
  const toggleReminder = useToggleReminder(id);
  const deleteReminder = useDeleteReminder(id);
  const deletePet = useDeletePet();

  // Notification scheduling is best-effort: the reminder state is already
  // saved, so a scheduler failure must not surface as an unhandled rejection.
  const syncNotification = (r: Reminder, nextDone: boolean) => {
    const work = nextDone
      ? cancelReminderNotification(r.id)
      : scheduleReminderNotification(r.id, r.title, r.dueDate);
    work.catch(() => {});
  };

  const confirmDeleteReminder = (r: Reminder) =>
    Alert.alert('Delete reminder?', `"${r.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteReminder.mutate(r.id, {
            onSuccess: () => cancelReminderNotification(r.id).catch(() => {}),
            onError: (err) => Alert.alert('Could not delete', getErrorMessage(err)),
          }),
      },
    ]);

  const confirmDeletePet = () =>
    Alert.alert(
      `Delete ${pet?.name ?? 'this pet'}?`,
      'This permanently deletes the pet and all of their health records and reminders. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deletePet.mutate(id, {
              onSuccess: () => {
                (reminders ?? []).forEach((r) => cancelReminderNotification(r.id).catch(() => {}));
                router.replace('/');
              },
              onError: (err) => Alert.alert('Could not delete', getErrorMessage(err)),
            }),
        },
      ],
    );

  return (
    <ScrollView
      style={styles.safe}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetchingSummary}
          onRefresh={() => {
            refetchSummary();
            refetchReminders();
          }}
        />
      }>
      <View style={styles.header}>
        <Text style={styles.petName}>{pet?.name ?? 'Pet'}</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.scanButton}
            onPress={() => router.push(`/pet/${id}/scan`)}
            accessibilityRole="button"
            accessibilityLabel="Scan a document">
            <Text style={styles.scanButtonText}>Scan</Text>
          </Pressable>
          <Pressable
            style={styles.addButton}
            onPress={() => router.push(`/pet/${id}/add-record`)}
            accessibilityRole="button"
            accessibilityLabel="Add a health record">
            <Text style={styles.addButtonText}>+ Add Record</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.reminderHeader}>
        <Text style={styles.sectionTitle}>Reminders</Text>
        <Pressable
          onPress={() => router.push(`/pet/${id}/add-reminder`)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Add a reminder">
          <Text style={styles.reminderAddLink}>+ Add</Text>
        </Pressable>
      </View>
      {!reminders || reminders.length === 0 ? (
        <Text style={styles.emptyTextSmall}>No reminders yet.</Text>
      ) : (
        reminders.map((r) => (
          <ReminderRow
            key={r.id}
            reminder={r}
            onToggle={() => {
              const nextDone = !r.isDone;
              toggleReminder.mutate(
                { id: r.id, isDone: nextDone },
                {
                  onSuccess: () => syncNotification(r, nextDone),
                  onError: (err) => Alert.alert('Could not update reminder', getErrorMessage(err)),
                },
              );
            }}
            onDelete={() => confirmDeleteReminder(r)}
          />
        ))
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : isError ? (
        <View>
          <Text style={styles.errorText}>{getErrorMessage(summaryError, "Couldn't load the health summary.")}</Text>
          <Pressable style={styles.retryButton} onPress={() => refetchSummary()} accessibilityRole="button">
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : !summary ? (
        <Text style={styles.emptyText}>No AI summary yet — add a few health records first.</Text>
      ) : (
        <>
          <Text style={styles.sectionTitle}>What Happened</Text>
          <Text style={styles.bodyText}>{summary.whatHappened}</Text>

          {summary.whatChanged.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>What Changed</Text>
              {summary.whatChanged.map((c, i) => (
                <ChangedRow key={i} item={c} />
              ))}
            </>
          ) : null}

          {summary.patterns.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Patterns</Text>
              {summary.patterns.map((p: Pattern) => (
                <ExplainableCard
                  key={p.id}
                  title={p.description}
                  reasoning={`Based on ${p.sourceRecordIds.length} record(s). Confidence: ${p.confidence}.`}
                />
              ))}
            </>
          ) : null}

          {summary.attention.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>May Need Attention</Text>
              {summary.attention.map((a: AttentionItem) => (
                <ExplainableCard key={a.id} title={a.message} reasoning={a.reasoning} />
              ))}
            </>
          ) : null}

          <Text style={styles.disclaimer}>
            This summary is generated from the records you saved. It is not a diagnosis or veterinary advice —
            talk to your vet about any health concerns.
          </Text>
        </>
      )}

      <Pressable
        style={styles.deleteButton}
        onPress={confirmDeletePet}
        disabled={deletePet.isPending}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${pet?.name ?? 'this pet'}`}>
        <Text style={styles.deleteButtonText}>{deletePet.isPending ? 'Deleting…' : 'Delete pet'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  petName: { fontSize: 26, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8 },
  addButton: { backgroundColor: '#208AEF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  scanButton: { backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  scanButtonText: { color: '#333', fontWeight: '600', fontSize: 13 },
  loading: { marginTop: 40 },
  emptyText: { color: '#666', fontSize: 15, marginTop: 20 },
  errorText: { color: '#d33', fontSize: 14, marginTop: 20 },
  retryButton: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#f0f0f0' },
  retryButtonText: { color: '#208AEF', fontWeight: '600' },
  disclaimer: { fontSize: 12, color: '#888', marginTop: 20, lineHeight: 17 },
  deleteButton: { marginTop: 36, borderWidth: 1, borderColor: '#d33', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  deleteButtonText: { color: '#d33', fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#208AEF', marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  bodyText: { fontSize: 15, color: '#333', lineHeight: 22 },
  changeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  changeMetric: { fontSize: 15, color: '#333', textTransform: 'capitalize' },
  changeDelta: { fontSize: 15, fontWeight: '600' },
  changeUp: { color: '#d97706' },
  changeDown: { color: '#16a34a' },
  card: { backgroundColor: '#f7f7f8', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardText: { fontSize: 15, color: '#222' },
  whyLink: { fontSize: 13, color: '#208AEF', marginTop: 8, fontWeight: '600' },
  reasoning: { fontSize: 13, color: '#666', marginTop: 6, lineHeight: 18 },
  reminderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  reminderAddLink: { fontSize: 13, color: '#208AEF', fontWeight: '600' },
  emptyTextSmall: { fontSize: 13, color: '#999', marginBottom: 8 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  reminderCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderCheckboxDone: { backgroundColor: '#208AEF' },
  reminderCheckmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  reminderBody: { flex: 1 },
  reminderTitle: { fontSize: 15, color: '#222' },
  reminderTitleDone: { color: '#999', textDecorationLine: 'line-through' },
  reminderDate: { fontSize: 12, color: '#999', marginTop: 2 },
});
