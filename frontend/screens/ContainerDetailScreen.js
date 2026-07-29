import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors, spacing, radius } from '../theme/colors';
import { API_URL, supabase } from '../lib/supabase';

export default function ContainerDetailScreen({ route }) {
  const { key, title } = route.params;
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    fetchEntries();
  }, [key]);

  const fetchEntries = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // TODO: implement GET /containers/{key}/entries on the backend
      const res = await fetch(`${API_URL}/containers/${key}/entries`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setEntries(await res.json());
    } catch (err) {
      console.log('Container fetch error', err);
    }
  };

  const addEntry = () => {
    // TODO: navigate to or open a modal for logging a new entry against this container
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          <Text style={styles.empty}>No entries yet for {title}. Log your first one to start building proof here.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.entry}>
            <Text style={styles.entryTitle}>{item.title}</Text>
            <Text style={styles.entryDate}>{item.date}</Text>
          </View>
        )}
      />
      <Pressable style={styles.fab} onPress={addEntry}>
        <Text style={styles.fabText}>+ Log entry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, lineHeight: 20 },
  entry: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  entryTitle: { color: colors.textPrimary, fontWeight: '600' },
  entryDate: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  fabText: { color: colors.background, fontWeight: '700' },
});
