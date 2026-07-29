import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { registerForPushNotificationsAsync } from '../lib/notifications';

export default function ProfileScreen({ navigation }) {
  const [notificationsOn, setNotificationsOn] = useState(true);

  const toggleNotifications = async (value) => {
    setNotificationsOn(value);
    if (value) {
      // Re-request permission / re-register the token if the user turns it back on
      await registerForPushNotificationsAsync();
    }
    // TODO: if you want a hard opt-out (not just "stop asking"), also tell the backend
    // to stop sending this user's stored push token nudges rather than just ignoring it here.
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* TODO: show real user info pulled from Supabase profile row */}
      <View style={styles.row}>
        <Ionicons name="person-outline" size={20} color={colors.gold} style={styles.rowIcon} />
        <Text style={styles.rowLabel}>Account</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="notifications-outline" size={20} color={colors.gold} style={styles.rowIcon} />
        <Text style={[styles.rowLabel, { flex: 1 }]}>Notifications</Text>
        <Switch
          value={notificationsOn}
          onValueChange={toggleNotifications}
          trackColor={{ false: colors.border, true: colors.goldDim }}
          thumbColor={notificationsOn ? colors.gold : colors.textMuted}
        />
      </View>

      <View style={styles.row}>
        <Ionicons name="videocam-outline" size={20} color={colors.gold} style={styles.rowIcon} />
        <Text style={styles.rowLabel}>Day Zero video</Text>
      </View>

      <Pressable style={styles.signOut} onPress={confirmSignOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} style={{ marginRight: 6 }} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowIcon: { marginRight: spacing.sm },
  rowLabel: { color: colors.textPrimary, fontWeight: '600' },
  signOut: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  signOutText: { color: colors.danger, fontWeight: '700' },
});
