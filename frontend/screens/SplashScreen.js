import { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';

const ONBOARDING_COMPLETE_KEY = 'default-zero:onboarding-complete';

// Needs: frontend/assets/logo.png (already have this one)
export default function SplashScreen({ navigation }) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 900, useNativeDriver: true }).start();

    const timer = setTimeout(async () => {
      const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      navigation.replace(onboardingComplete === 'true' ? 'Dashboard' : 'Onboarding');
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fade, alignItems: 'center' }}>
        <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>PROOF OVER PERFORMANCE</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 220,
  },
  tagline: {
    marginTop: 18,
    color: colors.gold,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3,
  },
});
