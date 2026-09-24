import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePets } from '@/hooks/use-pets';
import { aiService } from '@/services/ai';
import { getErrorMessage } from '@/services/errors';
import type { ChatMessage } from '@/types';

const MAX_MESSAGE_LENGTH = 2000;

const SUGGESTED_PROMPTS = [
  'What changed in the last month?',
  'Should I be worried about anything?',
  'Summarize the last vet visit',
];

export default function ChatScreen() {
  const { data: pets, isLoading: petsLoading } = usePets();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const petId = selectedPetId ?? pets?.[0]?.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stop an in-flight answer if the user leaves the screen.
  useEffect(() => () => abortRef.current?.abort(), []);

  function selectPet(id: string) {
    if (id === petId) return;
    abortRef.current?.abort();
    setSelectedPetId(id);
    setMessages([]);
    setSending(false);
  }

  async function send(text: string) {
    if (!petId || !text.trim() || sending) return;
    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    const assistantId = `${Date.now()}-a`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const stream = await aiService.chatStream(petId, userMsg.content, controller.signal);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m)),
        );
      }
      if (!full.trim()) throw new Error('empty answer');
    } catch (err) {
      // Left the screen or switched pet: nothing to report.
      if (controller.signal.aborted) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: getErrorMessage(err, "Sorry, I couldn't get an answer. Please try again.") }
            : m,
        ),
      );
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <Text style={styles.title}>Ask about {pets?.find((p) => p.id === petId)?.name ?? 'your pet'}</Text>

        {pets && pets.length > 1 ? (
          <View style={styles.petRow} accessibilityRole="tablist">
            {pets.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.petChip, p.id === petId && styles.petChipActive]}
                onPress={() => selectPet(p.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: p.id === petId }}
                accessibilityLabel={`Chat about ${p.name}`}>
                <Text style={[styles.petChipText, p.id === petId && styles.petChipTextActive]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!petId ? (
          <View style={styles.suggestions}>
            <Text style={styles.emptyText}>
              {petsLoading ? 'Loading your pets…' : 'Add a pet on the Home tab to start chatting about their health.'}
            </Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.suggestions}>
            <Text style={styles.disclaimer}>
              Answers are based only on the records you have saved and are not veterinary advice.
            </Text>
            {SUGGESTED_PROMPTS.map((p) => (
              <Pressable key={p} style={styles.suggestionChip} onPress={() => send(p)} accessibilityRole="button">
                <Text style={styles.suggestionText}>{p}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
                  {item.content || '…'}
                </Text>
              </View>
            )}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question…"
            value={input}
            onChangeText={setInput}
            editable={!sending && !!petId}
            maxLength={MAX_MESSAGE_LENGTH}
            accessibilityLabel="Your question"
            onSubmitEditing={() => send(input)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send question"
            style={[styles.sendButton, (!input.trim() || sending || !petId) && styles.sendButtonDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || sending || !petId}>
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  petRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  petChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: '#f0f0f0', minHeight: 36 },
  petChipActive: { backgroundColor: '#208AEF' },
  petChipText: { fontSize: 14, color: '#444' },
  petChipTextActive: { color: '#fff', fontWeight: '600' },
  emptyText: { fontSize: 15, color: '#666', textAlign: 'center' },
  disclaimer: { fontSize: 12, color: '#777', marginBottom: 4 },
  suggestions: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  suggestionChip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionText: { fontSize: 14, color: '#333' },
  list: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: '#208AEF', alignSelf: 'flex-end' },
  bubbleAssistant: { backgroundColor: '#f0f0f0', alignSelf: 'flex-start' },
  bubbleTextUser: { color: '#fff', fontSize: 15 },
  bubbleTextAssistant: { color: '#222', fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#208AEF',
    borderRadius: 20,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontWeight: '600' },
});
