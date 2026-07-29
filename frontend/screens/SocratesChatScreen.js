import { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { API_URL, supabase } from '../lib/supabase';

export default function SocratesChatScreen() {
  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'assistant', text: 'What are you avoiding today?' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const authHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
  };

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { id: String(Date.now()), role: 'user', text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const headers = await authHeader();
      const res = await fetch(`${API_URL}/socrates/message`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          text: data.reply ?? '...',
          safetyMode: data.safety_mode,
          suggestedContainer: data.suggested_container,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: 'err', role: 'assistant', text: "Couldn't reach Socrates. Try again." }]);
    } finally {
      setSending(false);
    }
  };

  const acceptContainerSuggestion = async (title, messageId) => {
    try {
      const headers = await authHeader();
      await fetch(`${API_URL}/containers/list`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, source: 'socrates' }),
      });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, suggestedContainer: null, accepted: title } : m)));
      Alert.alert('Added', `"${title}" is now on your dashboard.`);
    } catch (err) {
      Alert.alert('Failed to add container', err.message);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View>
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                item.safetyMode && styles.bubbleSafety,
              ]}
            >
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
            {item.suggestedContainer && (
              <Pressable
                style={styles.suggestionChip}
                onPress={() => acceptContainerSuggestion(item.suggestedContainer, item.id)}
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.gold} style={{ marginRight: 6 }} />
                <Text style={styles.suggestionText}>Add "{item.suggestedContainer}" as a container</Text>
              </Pressable>
            )}
            {item.accepted && (
              <Text style={styles.acceptedNote}>Added "{item.accepted}" to your dashboard.</Text>
            )}
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Talk to Socrates..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
        />
        <Pressable style={styles.sendButton} onPress={send} disabled={sending}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.xs },
  bubbleAssistant: { backgroundColor: colors.surface, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border },
  bubbleUser: { backgroundColor: colors.gold, alignSelf: 'flex-end' },
  bubbleSafety: { backgroundColor: colors.surfaceAlt, borderColor: colors.success, borderWidth: 1 },
  bubbleText: { color: colors.textPrimary },
  suggestionChip: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', borderWidth: 1, borderColor: colors.gold,
    borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.sm, marginBottom: spacing.sm,
  },
  suggestionText: { color: colors.gold, fontSize: 12, fontWeight: '600' },
  acceptedNote: { color: colors.success, fontSize: 12, marginBottom: spacing.sm, alignSelf: 'flex-start' },
  inputRow: { flexDirection: 'row', padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  sendButton: { justifyContent: 'center', paddingHorizontal: spacing.md },
  sendText: { color: colors.gold, fontWeight: '700' },
});
