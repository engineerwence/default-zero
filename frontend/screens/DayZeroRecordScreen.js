import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ImageBackground } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing, radius } from '../theme/colors';

// Needs: frontend/assets/day-zero-bg.jpg for the pre-recording screen background (optional, falls back to solid color)
// This screen is intentionally a one-way door: once recorded, there is no re-record and no edit.
export default function DayZeroRecordScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const cameraRef = useRef(null);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.body}>Default Zero needs camera access to record your Day Zero video.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant camera access</Text>
        </Pressable>
      </View>
    );
  }

  const startRecording = async () => {
    if (!cameraRef.current) return;
    setIsRecording(true);
    try {
      // TODO: expo-camera video recording + upload to Supabase Storage bucket 'day-zero-videos'
      // const video = await cameraRef.current.recordAsync({ maxDuration: 120 });
      // then upload video.uri to Supabase storage, save the returned URL against this user's profile
    } catch (err) {
      Alert.alert('Recording failed', err.message);
    }
  };

  const stopRecording = () => {
    cameraRef.current?.stopRecording();
    setIsRecording(false);
    setConfirmed(true);
  };

  const finish = () => {
    Alert.alert(
      'This is permanent',
      'Your Day Zero video cannot be edited or re-recorded once submitted. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit Day Zero', style: 'destructive', onPress: () => navigation.replace('Dashboard') },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {!confirmed ? (
        <>
          <CameraView ref={cameraRef} style={styles.camera} facing="front" mode="video" />
          <Text style={styles.instruction}>
            Say who you are today, honestly. This is the version of you that everything else gets measured against.
          </Text>
          <Pressable
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Text style={styles.buttonText}>{isRecording ? 'Stop' : 'Start recording'}</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.confirmBox}>
          <Text style={styles.heading}>Day Zero recorded</Text>
          <Text style={styles.body}>
            This video is now locked. It won't be visible for editing — only as your starting point.
          </Text>
          <Pressable style={styles.button} onPress={finish}>
            <Text style={styles.buttonText}>Lock it in</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  camera: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  instruction: { color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.lg, lineHeight: 20 },
  heading: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'center' },
  body: { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 20 },
  recordButton: { backgroundColor: colors.gold, paddingVertical: 16, paddingHorizontal: spacing.xl, borderRadius: radius.pill },
  recordButtonActive: { backgroundColor: colors.danger },
  confirmBox: { alignItems: 'center', paddingHorizontal: spacing.lg },
  button: { backgroundColor: colors.gold, paddingVertical: 16, paddingHorizontal: spacing.xl, borderRadius: radius.md },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
