import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePet } from '@/hooks/use-pets';
import { useReminders, useToggleReminder } from '@/hooks/use-reminders';
import { useHealthSummary } from '@/hooks/use-summary';
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

function ReminderRow({ reminder, onToggle }: { reminder: Reminder; onToggle: () => void }) {
  return (
    <Pressable style={styles.reminderRow} onPress={onToggle}>
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
  const { data: summary, isLoading, isError, refetch: refetchSummary, isRefetching: isRefetchingSummary } =
    useHealthSummary(id);
  const { data: reminders, refetch: refetchReminders } = useReminders(id);
  const toggleReminder = useToggleReminder(id);

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
          <Pressable style={styles.scanButton} onPress={() => router.push(`/pet/${id}/scan`)}>
            <Text style={styles.scanButtonText}>Scan</Text>
          </Pressable>
          <Pressable style={styles.addButton} onPress={() => router.push(`/pet/${id}/add-record`)}>
            <Text style={styles.addButtonText}>+ Add Record</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.reminderHeader}>
        <Text style={styles.sectionTitle}>Reminders</Text>
        <Pressable onPress={() => router.push(`/pet/${id}/add-reminder`)}>
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
              toggleReminder.mutate({ id: r.id, isDone: nextDone });
              if (nextDone) {
                cancelReminderNotification(r.id);
              } else {
                scheduleReminderNotification(r.id, r.title, r.dueDate);
              }
            }}
          />
        ))
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : isError || !summary ? (
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
        </>
      )}
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
