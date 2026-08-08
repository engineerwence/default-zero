import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { API_URL } from '../lib/supabase';

export default function GoalsScreen() {
  const [goals, setGoals] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');

  const authHeader = () => ({ Authorization: 'Bearer ' });

  const load = useCallback(async () => {
    try {
      const headers = authHeader();
      const res = await fetch(`${API_URL}/goals`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Goals could not be loaded.');
      setGoals(data);
    } catch (err) {
      setError(err.message);
      console.log('Goals load error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addGoal = async () => {
    if (!title.trim()) return;
    try {
      const headers = authHeader();
      const res = await fetch(`${API_URL}/goals`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Goal could not be added.');
      setTitle('');
      setError('');
      load();
    } catch (err) {
      Alert.alert('Failed to add goal', err.message);
    }
  };

  const nudgeProgress = async (goal) => {
    const next = Math.min(goal.progress_percent + 10, 100);
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_URL}/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress_percent: next, status: next === 100 ? 'completed' : 'active' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Goal progress could not be updated.');
      load();
    } catch (err) {
      Alert.alert('Failed to update', err.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {goals.length === 0 ? (
        <Text style={styles.empty}>No goals yet. Discipline needs something to point at — add one below.</Text>
      ) : (
        goals.map((g) => (
          <Pressable key={g.id} style={styles.goalCard} onPress={() => nudgeProgress(g)}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalTitle}>{g.title}</Text>
              {g.status === 'completed' && <Ionicons name="checkmark-circle" size={24} color={colors.success} />}
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${g.progress_percent}%` }]} />
            </View>
            <Text style={styles.goalSub}>{g.progress_percent}% — tap to log progress</Text>
          </Pressable>
        ))
      )}

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="New goal, e.g. 'Show up on time for a month'"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={addGoal}
        />
        <Pressable style={styles.addButton} onPress={addGoal}>
          <Text style={styles.addButtonText}>Add goal</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 17, lineHeight: 25, textAlign: 'center', marginBottom: spacing.md },
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.textMuted, textAlign: 'center', fontSize: 17, marginTop: spacing.xl, marginBottom: spacing.xl, lineHeight: 26 },
  goalCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  goalTitle: { color: colors.textPrimary, fontWeight: '600', fontSize: 17, flex: 1 },
  progressTrack: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold },
  goalSub: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
  form: { marginTop: spacing.lg },
  input: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 15, color: colors.textPrimary, fontSize: 17, marginBottom: spacing.sm,
  },
  addButton: { backgroundColor: colors.gold, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  addButtonText: { color: colors.background, fontWeight: '700', fontSize: 17 },
});
