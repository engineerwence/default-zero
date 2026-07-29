import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase, API_URL } from './supabase';

// Foreground behavior: still show the alert + play the custom sound even while the app is open,
// so a nudge doesn't go silent just because the user already has Default Zero in front of them.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    // The 'sound' field here must match a filename already bundled via the expo-notifications
    // config plugin in app.json (see assets/sounds/neigh.wav) — Android requires a notification
    // channel to reference it, it can't just be passed at send-time like iOS allows.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default Zero nudges',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'neigh.wav',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D4A94F',
    });
  }

  if (!Device.isDevice) {
    console.log('Push notifications require a physical device, not a simulator.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Push notification permission was not granted.');
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
  const pushToken = tokenResponse.data;

  // Save the token against this user so the backend can send them nudges later.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetch(`${API_URL}/notifications/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ push_token: pushToken }),
      });
    }
  } catch (err) {
    console.log('Failed to register push token', err);
  }

  return pushToken;
}

// Call this once near the top of the app (App.js) — registers on mount and re-registers
// if permissions change while the app is open.
export function usePushNotifications() {
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync();

    // Fires when the user taps a notification — wire navigation here later
    // (e.g. tapping a "log your Physical container" nudge could deep-link straight to it).
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped', response);
    });

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);
}
