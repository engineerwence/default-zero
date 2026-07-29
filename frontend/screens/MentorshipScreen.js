import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { API_URL, supabase } from '../lib/supabase';

const CONTAINERS = [
  { key: 'money', label: 'Money' },
  { key: 'physical', label: 'Physical' },
  { key: 'spiritual', label: 'Spiritual' },
  { key: 'mind', label: 'Mind' },
];

export default function MentorshipScreen() {
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [role, setRole] = useState('mentee'); // 'mentee' | 'mentor'
  const [lane, setLane] = useState('container'); // 'container' | 'profession'
  const [selectedContainer, setSelectedContainer] = useState('money');
  const [profession, setProfession] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    fetchMatch();
  }, []);

  const authHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
  };

  const fetchMatch = async () => {
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_URL}/mentorship/match`, { headers });
      if (res.ok) setMatch(await res.json());
    } catch (err) {
      console.log('Mentorship fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (lane === 'profession' && !profession.trim()) return;
    setRequesting(true);
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_URL}/mentorship/request`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          ...(lane === 'container' ? { container_key: selectedContainer } : { profession: profession.trim() }),
        }),
      });
      const data = await res.json();
      setLastResult(data);
      if (role === 'mentor') {
        Alert.alert('You\'re in', 'You\'ll be matched with mentees automatically as requests come in.');
      } else if (data.status === 'matched') {
        fetchMatch();
      } else {
        Alert.alert('Request sent', data.reason ?? 'No mentor available yet — you\'ll be matched as soon as one is.');
      }
    } catch (err) {
      Alert.alert('Failed', err.message);
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (match) {
    return (
      <View style={styles.container}>
        <Ionicons name="people-circle-outline" size={48} color={colors.gold} style={{ marginBottom: spacing.md }} />
        <Text style={styles.heading}>Matched in the {match.lane} lane</Text>
        <Text style={styles.body}>Mentor ID: {match.mentor_id}</Text>
        {/* TODO: chat / contact UI with the matched mentor, and show their actual name/profile */}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>No mentor matched yet</Text>
      <Text style={styles.body}>
        Get matched with someone further along — by life container or by profession — or opt in to mentor
        someone else yourself.
      </Text>

      <View style={styles.modeSwitch}>
        <Pressable style={[styles.modeChip, role === 'mentee' && styles.modeChipActive]} onPress={() => setRole('mentee')}>
          <Text style={[styles.modeChipText, role === 'mentee' && styles.modeChipTextActive]}>I want a mentor</Text>
        </Pressable>
        <Pressable style={[styles.modeChip, role === 'mentor' && styles.modeChipActive]} onPress={() => setRole('mentor')}>
          <Text style={[styles.modeChipText, role === 'mentor' && styles.modeChipTextActive]}>I'll mentor others</Text>
        </Pressable>
      </View>

      <View style={styles.modeSwitch}>
        <Pressable style={[styles.modeChip, lane === 'container' && styles.modeChipActive]} onPress={() => setLane('container')}>
          <Text style={[styles.modeChipText, lane === 'container' && styles.modeChipTextActive]}>By container</Text>
        </Pressable>
        <Pressable style={[styles.modeChip, lane === 'profession' && styles.modeChipActive]} onPress={() => setLane('profession')}>
          <Text style={[styles.modeChipText, lane === 'profession' && styles.modeChipTextActive]}>By profession</Text>
        </Pressable>
      </View>

      {lane === 'container' ? (
        <View style={styles.containerRow}>
          {CONTAINERS.map((c) => (
            <Pressable
              key={c.key}
              style={[styles.containerChip, selectedContainer === c.key && styles.containerChipActive]}
              onPress={() => setSelectedContainer(c.key)}
            >
              <Text style={[styles.containerChipText, selectedContainer === c.key && styles.containerChipTextActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Type your profession, e.g. Software Engineer"
          placeholderTextColor={colors.textMuted}
          value={profession}
          onChangeText={setProfession}
        />
      )}

      <Pressable style={styles.button} onPress={submit} disabled={requesting}>
        {requesting ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>{role === 'mentor' ? 'Opt in as a mentor' : 'Request a match'}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  heading: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm },
  body: { color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  modeSwitch: { flexDirection: 'row', marginBottom: spacing.md, width: '100%' },
  modeChip: {
    flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginHorizontal: 4,
    borderRadius: radius.sm,
  },
  modeChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  modeChipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  modeChipTextActive: { color: colors.background },
  containerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: spacing.lg },
  containerChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: spacing.md,
    margin: 4,
  },
  containerChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  containerChipText: { color: colors.textSecondary, fontSize: 13 },
  containerChipTextActive: { color: colors.background, fontWeight: '700' },
  input: {
    width: '100%', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.textPrimary, marginBottom: spacing.lg,
  },
  button: { backgroundColor: colors.gold, paddingVertical: 14, paddingHorizontal: spacing.xl, borderRadius: radius.md, width: '100%', alignItems: 'center' },
  buttonText: { color: colors.background, fontWeight: '700' },
});
