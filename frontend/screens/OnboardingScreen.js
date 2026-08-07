import { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, Pressable, Image } from 'react-native';
import { colors, spacing, radius } from '../theme/colors';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    title: 'No more talk. Proof.',
    body: 'Default Zero doesn\u2019t track your intentions. It tracks what you actually did — recorded, timestamped, uneditable.',
  },
  {
    key: '2',
    title: 'Life, in containers',
    body: 'Money. Physical. Spiritual. Mind. Each one tracked on its own terms, so you can\u2019t hide a weak area behind a strong one.',
  },
  {
    key: '3',
    title: 'You start at zero',
    body: 'Your Day Zero video is the line in the sand. Everything after it is measured against who you said you\u2019d become.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1 });
      setIndex(index + 1);
    } else {
      navigation.replace('DayZeroRecord');
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Image source={require('../assets/logo.png')} style={styles.mark} resizeMode="contain" />
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <Pressable style={styles.button} onPress={next}>
        <Text style={styles.buttonText}>{index === SLIDES.length - 1 ? 'Get started' : 'Next'}</Text>
      </Pressable>

      {index < SLIDES.length - 1 && (
        <Pressable onPress={() => navigation.replace('DayZeroRecord')}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 80, paddingBottom: 48 },
  slide: { alignItems: 'center', paddingHorizontal: spacing.xl },
  mark: { width: 96, height: 96, marginBottom: spacing.xl },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md },
  body: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border, marginHorizontal: 4 },
  dotActive: { backgroundColor: colors.gold, width: 18 },
  button: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 16 },
  skip: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.md },
});
