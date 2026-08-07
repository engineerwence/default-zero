import { Platform, PermissionsAndroid } from 'react-native';
import { API_URL } from './supabase';

// Reading a user's own SMS inbox is the real mechanism for auto-importing M-Pesa spending,
// since Daraja has no API for that (it only sees transactions to YOUR paybill/till, not
// the user's general spending). This only works on Android — iOS does not allow
// third-party apps to read SMS at all, full stop, so there is no equivalent path there.
// This ALSO only works in a real EAS build, not Expo Go, since it needs a native module.

export async function requestSmsPermission() {
  if (Platform.OS !== 'android') return false;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    {
      title: 'Read M-Pesa messages',
      message:
        'Default Zero reads your M-Pesa confirmation texts to auto-track your spending in the Money container. It does not read any other messages.',
      buttonPositive: 'Allow',
    }
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function importMpesaSms() {
  if (Platform.OS !== 'android') {
    throw new Error('Automatic M-Pesa import is only available on Android. Add entries manually here on iOS.');
  }

  const hasPermission = await requestSmsPermission();
  if (!hasPermission) {
    throw new Error('SMS permission was not granted.');
  }

  // react-native-get-sms-android's API is callback-based; wrap it in a promise.
  const SmsAndroid = require('react-native-get-sms-android');

  const messages = await new Promise((resolve, reject) => {
    const filter = {
      box: 'inbox',
      address: 'MPESA', // narrows to M-Pesa sender IDs where possible; parser double-checks content too
      maxCount: 200,
    };
    SmsAndroid.list(
      JSON.stringify(filter),
      (fail) => reject(new Error(fail)),
      (count, smsList) => resolve(JSON.parse(smsList))
    );
  });

  const res = await fetch(`${API_URL}/finance/import/sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ',
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ raw_text: m.body })),
    }),
  });

  if (!res.ok) throw new Error('Import failed on the server.');
  return res.json(); // { imported, skipped }
}
