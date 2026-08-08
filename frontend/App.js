import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import { usePushNotifications } from './lib/notifications';

export default function App() {
  usePushNotifications();

  useEffect(() => {
    if (__DEV__) return;

    Updates.checkForUpdateAsync()
      .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : null))
      .then((result) => (result?.isNew ? Updates.reloadAsync() : null))
      .catch((error) => console.log('OTA update check skipped', error.message));
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <AppNavigator />
    </NavigationContainer>
  );
}
