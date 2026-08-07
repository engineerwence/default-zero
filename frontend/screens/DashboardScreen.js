import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import ContainerCard from '../components/ContainerCard';
import { API_URL } from '../lib/supabase';

export default function DashboardScreen({ navigation }) {
  const [containers, setContainers] = useState([]);
  const [scores, setScores] = useState({});
  const [proofScore, setProofScore] = useState(null);
  const [loading, setLoading] = useState(true);

  const authHeader = () => ({ Authorization: 'Bearer ' });

  const fetchAll = useCallback(async () => {
    try {
      const headers = await authHeader();
      const [listRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/containers/list`, { headers }),
        fetch(`${API_URL}/containers/summary`, { headers }),
      ]);
      if (listRes.ok) setContainers(await listRes.json());
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setScores(data.containers ?? {});
        setProofScore(data.proof_score ?? null);
      }
    } catch (err) {
      console.log('Dashboard fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const promptAddContainer = () => {
    Alert.prompt?.(
      'New container',
      'What area of your life do you want to track?',
      async (title) => {
        if (!title?.trim()) return;
        const headers = authHeader();
        await fetch(`${API_URL}/containers/list`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim() }),
        });
        fetchAll();
      }
    ) ??
      // Alert.prompt is iOS-only — Android falls back to just navigating somewhere with a text input.
      // TODO: build a small AddContainerModal for Android parity instead of this fallback.
      Alert.alert('Add a container', 'On Android, add custom containers from the Socrates chat instead — it can propose one from your conversation, or ask it to create one for you.');
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
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>PROOF SCORE</Text>
        <Text style={styles.scoreValue}>{proofScore ?? '—'}</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your containers</Text>
        <Pressable onPress={promptAddContainer}>
          <Ionicons name="add-circle-outline" size={22} color={colors.gold} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {containers.map((c) => (
          <ContainerCard
            key={c.slug}
            title={c.title}
            score={scores[c.slug] ?? 0}
            icon={null}
            containerKey={c.slug}
            iconName={c.icon}
            onPress={() =>
              c.slug === 'money'
                ? navigation.navigate('Finance')
                : navigation.navigate('ContainerDetail', { key: c.slug, title: c.title })
            }
          />
        ))}
      </View>

      <View style={styles.linksRow}>
        <Pressable style={styles.linkCard} onPress={() => navigation.navigate('Goals')}>
          <Ionicons name="flag-outline" size={20} color={colors.gold} style={{ marginBottom: 4 }} />
          <Text style={styles.linkText}>Goals</Text>
        </Pressable>
        <Pressable style={styles.linkCard} onPress={() => navigation.navigate('Mentorship')}>
          <Ionicons name="people-outline" size={20} color={colors.gold} style={{ marginBottom: 4 }} />
          <Text style={styles.linkText}>Mentorship</Text>
        </Pressable>
        <Pressable style={styles.linkCard} onPress={() => navigation.navigate('SocratesChat')}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.gold} style={{ marginBottom: 4 }} />
          <Text style={styles.linkText}>Socrates</Text>
        </Pressable>
      </View>

      <Pressable style={styles.profileLink} onPress={() => navigation.navigate('Profile')}>
        <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
        <Text style={styles.profileLinkText}>Profile & settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  scoreLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 2, marginBottom: spacing.xs },
  scoreValue: { color: colors.gold, fontSize: 40, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  linksRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  linkCard: {
    flexBasis: '31%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  linkText: { color: colors.textPrimary, fontWeight: '600', fontSize: 12 },
  profileLink: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  profileLinkText: { color: colors.textSecondary },
});
