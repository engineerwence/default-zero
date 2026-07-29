import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import DayZeroRecordScreen from '../screens/DayZeroRecordScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ContainerDetailScreen from '../screens/ContainerDetailScreen';
import FinanceScreen from '../screens/FinanceScreen';
import GoalsScreen from '../screens/GoalsScreen';
import MentorshipScreen from '../screens/MentorshipScreen';
import SocratesChatScreen from '../screens/SocratesChatScreen';
import ProfileScreen from '../screens/ProfileScreen';

import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

// Screen order reflects the real user flow:
// Splash -> Onboarding (first run only) -> Auth -> Day Zero (mandatory, once) -> Dashboard -> everything else
export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DayZeroRecord" component={DayZeroRecordScreen} options={{ title: 'Day Zero', headerBackVisible: false }} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Default Zero', headerBackVisible: false }} />
      <Stack.Screen name="ContainerDetail" component={ContainerDetailScreen} options={({ route }) => ({ title: route.params?.title ?? 'Container' })} />
      <Stack.Screen name="Finance" component={FinanceScreen} options={{ title: 'Money' }} />
      <Stack.Screen name="Goals" component={GoalsScreen} options={{ title: 'Goals' }} />
      <Stack.Screen name="Mentorship" component={MentorshipScreen} options={{ title: 'Mentorship' }} />
      <Stack.Screen name="SocratesChat" component={SocratesChatScreen} options={{ title: 'Socrates' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Stack.Navigator>
  );
}
