import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { colors, spacing, radius } from '../theme/colors';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// Google sign-in via Supabase Auth. This is the only sign-in path — no email/password —
// because it works the same way across every device the user picks up the app on, with
// no password to forget or re-type on a phone keyboard.
//
// Setup needed in Supabase Dashboard -> Authentication -> Providers -> Google:
//   1. Create an OAuth client in Google Cloud Console (Web application type)
//   2. Add the Supabase callback URL (shown in that Supabase screen) as an Authorized redirect URI
//   3. Paste the Google Client ID + Secret into the Supabase Google provider settings
export default function AuthScreen({ navigation }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Covers the case where the user already has a valid Supabase session (e.g. reopening
    // the app on a device they signed in on before) — skip straight past this screen.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigation.replace('DayZeroRecord');
    });
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const redirectTo = AuthSession.makeRedirectUri({ scheme: 'defaultzero' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        setLoading(false);
        return; // user cancelled — not an error, just don't proceed
      }

      // Supabase returns tokens in the URL fragment after #, not as normal query params.
      const url = result.url.replace('#', '?');
      const params = new URLSearchParams(url.split('?')[1]);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (!access_token || !refresh_token) throw new Error('No session returned from Google sign-in.');

      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionError) throw sessionError;

      // TODO: check if this user already has a Day Zero video recorded (GET /day-zero/status).
      // If recorded -> Dashboard. If not -> DayZeroRecord (current default, correct for new users).
      navigation.replace('DayZeroRecord');
    } catch (err) {
      Alert.alert('Sign-in failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.heading}>Welcome to Default Zero</Text>
      <Text style={styles.subheading}>Proof over performance.</Text>

      <Pressable style={styles.googleButton} onPress={signInWithGoogle} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <>
            <Image source={require('../assets/google-icon.png')} style={styles.googleIcon} resizeMode="contain" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.note}>Same account, every device — no password to remember.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: spacing.xl },
  logo: { width: 84, height: 84, alignSelf: 'center', marginBottom: spacing.lg },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subheading: { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xxl },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: colors.textPrimary,
    paddingVertical: 15,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: { width: 20, height: 20, marginRight: spacing.sm },
  googleButtonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  note: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, fontSize: 12 },
});
