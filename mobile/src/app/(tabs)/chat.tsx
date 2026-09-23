import { useRef, useState } from 'react';
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
import type { ChatMessage } from '@/types';

const SUGGESTED_PROMPTS = [
  'What changed in the last month?',
  'Should I be worried about anything?',
  'Summarize the last vet visit',
];

export default function ChatScreen() {
  const { data: pets } = usePets();
  const petId = pets?.[0]?.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

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

    try {
      const stream = await aiService.chatStream(petId, userMsg.content);
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
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, I couldn't reach the assistant. Try again." }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <Text style={styles.title}>Ask about {pets?.find((p) => p.id === petId)?.name ?? 'your pet'}</Text>

        {messages.length === 0 ? (
          <View style={styles.suggestions}>
            {SUGGESTED_PROMPTS.map((p) => (
              <Pressable key={p} style={styles.suggestionChip} onPress={() => send(p)}>
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
            editable={!sending}
            onSubmitEditing={() => send(input)}
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || sending}>
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
