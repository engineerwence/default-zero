import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { colors, spacing, radius } from '../theme/colors';
import { API_URL, supabase } from '../lib/supabase';
import { importMpesaSms } from '../lib/smsImport';

const screenWidth = Dimensions.get('window').width - spacing.lg * 2;

const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(212, 169, 79, ${opacity})`, // gold
  labelColor: () => colors.textSecondary,
  propsForBackgroundLines: { stroke: colors.border },
};

export default function FinanceScreen() {
  const [summary, setSummary] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualType, setManualType] = useState('expense');
  const [manualCategory, setManualCategory] = useState('');

  const authHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
  };

  const load = useCallback(async () => {
    try {
      const headers = await authHeader();
      const [summaryRes, goalsRes] = await Promise.all([
        fetch(`${API_URL}/finance/summary`, { headers }),
        fetch(`${API_URL}/finance/goals`, { headers }),
      ]);
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (goalsRes.ok) setGoals(await goalsRes.json());
    } catch (err) {
      console.log('Finance load error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addManualEntry = async () => {
    const amount = parseFloat(manualAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a real amount greater than 0.');
      return;
    }
    try {
      const headers = await authHeader();
      await fetch(`${API_URL}/finance/transactions`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, type: manualType, category: manualCategory || null }),
      });
      setManualAmount('');
      setManualCategory('');
      load();
    } catch (err) {
      Alert.alert('Failed to save', err.message);
    }
  };

  const handleSmsImport = async () => {
    setImporting(true);
    try {
      const result = await importMpesaSms();
      Alert.alert('Import complete', `Imported ${result.imported} transactions, skipped ${result.skipped} unrecognized messages.`);
      load();
    } catch (err) {
      Alert.alert('Import unavailable', err.message);
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const monthlyEntries = Object.entries(summary?.monthly ?? {});
  const lineData = {
    labels: monthlyEntries.map(([month]) => month.slice(5)), // 'MM'
    datasets: [
      { data: monthlyEntries.map(([, v]) => v.income || 0), color: () => colors.success, strokeWidth: 2 },
      { data: monthlyEntries.map(([, v]) => v.expense || 0), color: () => colors.danger, strokeWidth: 2 },
    ],
  };

  const pieData = (summary?.top_categories ?? []).map((c, i) => ({
    name: c.category,
    amount: c.amount,
    color: [colors.gold, colors.goldDim, colors.danger, colors.success, colors.textMuted][i % 5],
    legendFontColor: colors.textSecondary,
    legendFontSize: 12,
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>SAVINGS RATE</Text>
          <Text style={styles.statValue}>{summary?.savings_rate_percent ?? 0}%</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>INCOME</Text>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {(summary?.total_income ?? 0).toLocaleString()}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>EXPENSE</Text>
          <Text style={[styles.statValue, { color: colors.danger }]}>
            {(summary?.total_expense ?? 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {monthlyEntries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Income vs expense — last 6 months</Text>
          <LineChart
            data={lineData}
            width={screenWidth}
            height={180}
            chartConfig={chartConfig}
            bezier
            style={{ borderRadius: radius.md, marginBottom: spacing.lg }}
          />
        </>
      )}

      {pieData.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Where it's going</Text>
          <PieChart
            data={pieData}
            width={screenWidth}
            height={160}
            chartConfig={chartConfig}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="8"
            style={{ marginBottom: spacing.lg }}
          />
        </>
      )}

      <Text style={styles.sectionTitle}>Savings goals</Text>
      {goals.length === 0 ? (
        <Text style={styles.empty}>No savings goals yet.</Text>
      ) : (
        goals.map((g) => (
          <View key={g.id} style={styles.goalCard}>
            <Text style={styles.goalTitle}>{g.title}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${g.progress_percent}%` }]} />
            </View>
            <Text style={styles.goalSub}>
              {g.progress_amount.toLocaleString()} / {g.target_amount.toLocaleString()} ({g.progress_percent}%)
            </Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Import M-Pesa transactions</Text>
      <Pressable style={styles.importButton} onPress={handleSmsImport} disabled={importing}>
        {importing ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <>
            <Ionicons name="download-outline" size={18} color={colors.background} style={{ marginRight: 6 }} />
            <Text style={styles.importButtonText}>
              {Platform.OS === 'android' ? 'Import from M-Pesa SMS' : 'Not available on iOS'}
            </Text>
          </>
        )}
      </Pressable>
      {Platform.OS !== 'android' && (
        <Text style={styles.note}>
          iOS doesn't allow apps to read SMS. Add entries manually below instead.
        </Text>
      )}

      <Text style={styles.sectionTitle}>Add manual entry</Text>
      <View style={styles.form}>
        <View style={styles.typeRow}>
          {['income', 'expense', 'savings'].map((t) => (
            <Pressable
              key={t}
              style={[styles.typeChip, manualType === t && styles.typeChipActive]}
              onPress={() => setManualType(t)}
            >
              <Text style={[styles.typeChipText, manualType === t && styles.typeChipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Amount (Ksh)"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          value={manualAmount}
          onChangeText={setManualAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Category (optional)"
          placeholderTextColor={colors.textMuted}
          value={manualCategory}
          onChangeText={setManualCategory}
        />
        <Pressable style={styles.saveButton} onPress={addManualEntry}>
          <Text style={styles.saveButtonText}>Log entry</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statLabel: { color: colors.textMuted, fontSize: 9, letterSpacing: 1, marginBottom: 4 },
  statValue: { color: colors.gold, fontWeight: '700', fontSize: 16 },
  sectionTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15, marginTop: spacing.md, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, marginBottom: spacing.md },
  goalCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  goalTitle: { color: colors.textPrimary, fontWeight: '600', marginBottom: spacing.sm },
  progressTrack: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold },
  goalSub: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs },
  importButton: {
    flexDirection: 'row', backgroundColor: colors.gold, paddingVertical: 14, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  importButtonText: { color: colors.background, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  form: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  typeRow: { flexDirection: 'row', marginBottom: spacing.sm },
  typeChip: {
    flex: 1, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', marginHorizontal: 2,
  },
  typeChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  typeChipText: { color: colors.textSecondary, fontSize: 12, textTransform: 'capitalize' },
  typeChipTextActive: { color: colors.background, fontWeight: '700' },
  input: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.textPrimary, marginBottom: spacing.sm,
  },
  saveButton: { backgroundColor: colors.goldDim, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
  saveButtonText: { color: colors.textPrimary, fontWeight: '700' },
});
