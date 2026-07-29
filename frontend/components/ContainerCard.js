import { Pressable, Text, View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/colors';

// icon prop: require(...) result for a custom PNG, if you have one for this container.
// iconName prop: an Ionicons name string (comes from the containers table, e.g. 'heart-outline')
// containerKey: fallback only, used if neither of the above is provided.
const FALLBACK_ICONS = {
  money: 'wallet-outline',
  physical: 'fitness-outline',
  spiritual: 'flame-outline',
  mind: 'bulb-outline',
  relationships: 'heart-outline',
  emotions: 'pulse-outline',
};

export default function ContainerCard({ title, score, icon, iconName, containerKey, onPress }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.iconWrap}>
        {icon ? (
          <Image source={icon} style={styles.icon} resizeMode="contain" />
        ) : (
          <Ionicons
            name={iconName ?? FALLBACK_ICONS[containerKey] ?? 'ellipse-outline'}
            size={26}
            color={colors.gold}
          />
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.score}>{score}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconWrap: { width: 40, height: 40, marginBottom: spacing.sm, justifyContent: 'center' },
  icon: { width: '100%', height: '100%' },
  title: { color: colors.textPrimary, fontWeight: '600', fontSize: 14, marginBottom: 2 },
  score: { color: colors.gold, fontWeight: '700', fontSize: 20 },
});
