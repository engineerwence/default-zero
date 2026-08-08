import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { API_URL } from '../lib/supabase';

function SocratesAvatar({ thinking }) {
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let active = true;
    const blinkOnce = () => {
      if (!active) return;
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.12, duration: 100, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 130, useNativeDriver: true }),
      ]).start(() => {
        if (active) setTimeout(blinkOnce, 2200 + Math.random() * 1800);
      });
    };
    const timer = setTimeout(blinkOnce, 1200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [blink]);

  return (
    <View style={[styles.avatar, thinking && styles.avatarThinking]}>
      <Animated.View style={[styles.eye, styles.eyeLeft, { transform: [{ scaleY: blink }] }]} />
      <Animated.View style={[styles.eye, styles.eyeRight, { transform: [{ scaleY: blink }] }]} />
      <View style={styles.nose} />
      <View style={styles.browLeft} />
      <View style={styles.browRight} />
    </View>
  );
}

export default function SocratesChatScreen() {
  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'assistant', text: 'What are you avoiding today?' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const authHeader = () => ({ Authorization: 'Bearer ' });

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { id: String(Date.now()), role: 'user', text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const headers = authHeader();
      const res = await fetch(`${API_URL}/socrates/message`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Socrates is unavailable right now.');
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
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'assistant', text: `Socrates is unavailable: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  };

  const acceptContainerSuggestion = async (title, messageId) => {
    try {
      const headers = authHeader();
      const res = await fetch(`${API_URL}/containers/list`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, source: 'socrates' }),
      });
      if (!res.ok) throw new Error('The server could not add this container.');
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, suggestedContainer: null, accepted: title } : m)));
      Alert.alert('Added', `"${title}" is now on your dashboard.`);
    } catch (err) {
      Alert.alert('Failed to add container', err.message);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.socratesPanel, sending && styles.socratesPanelThinking]}>
        <SocratesAvatar thinking={sending} />
        <View style={styles.socratesCopy}>
          <Text style={styles.socratesName}>SOCRATES</Text>
          <Text style={styles.socratesStatus}>{sending ? 'Thinking through your answer...' : 'Ask the question you are avoiding.'}</Text>
        </View>
        {sending && <View style={styles.thinkingDots}><Text style={styles.thinkingDotsText}>...</Text></View>}
      </View>
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
  bubbleText: { color: colors.textPrimary, fontSize: 19, lineHeight: 29 },
  suggestionChip: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', borderWidth: 1, borderColor: colors.gold,
    borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  suggestionText: { color: colors.gold, fontSize: 17, fontWeight: '600' },
  acceptedNote: { color: colors.success, fontSize: 17, marginBottom: spacing.sm, alignSelf: 'flex-start' },
  socratesPanel: {
    flexDirection: 'row', alignItems: 'center', margin: spacing.md, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  socratesPanelThinking: { backgroundColor: colors.surfaceAlt, borderColor: colors.goldDim },
  avatar: {
    width: 92, height: 92, borderRadius: 46, backgroundColor: colors.gold,
    borderWidth: 3, borderColor: colors.goldBright, position: 'relative', overflow: 'hidden',
  },
  avatarThinking: { transform: [{ scale: 0.88 }] },
  eye: { position: 'absolute', top: 28, width: 22, height: 28, borderRadius: 14, backgroundColor: colors.textPrimary },
  eyeLeft: { left: 19 },
  eyeRight: { right: 19 },
  browLeft: { position: 'absolute', top: 20, left: 17, width: 26, height: 5, borderRadius: 2, backgroundColor: colors.background, transform: [{ rotate: '-10deg' }] },
  browRight: { position: 'absolute', top: 20, right: 17, width: 26, height: 5, borderRadius: 2, backgroundColor: colors.background, transform: [{ rotate: '10deg' }] },
  nose: { position: 'absolute', top: 50, left: 42, width: 9, height: 12, borderRadius: 5, backgroundColor: colors.goldDim },
  socratesCopy: { flex: 1, marginLeft: spacing.md },
  socratesName: { color: colors.gold, fontSize: 17, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  socratesStatus: { color: colors.textSecondary, fontSize: 18, lineHeight: 26 },
  thinkingDots: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  thinkingDotsText: { color: colors.background, fontSize: 28, fontWeight: '700', marginTop: -10 },
  inputRow: { flexDirection: 'row', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 19,
    marginRight: spacing.sm,
  },
  sendButton: { justifyContent: 'center', paddingHorizontal: spacing.lg },
  sendText: { color: colors.gold, fontWeight: '700', fontSize: 19 },
});
