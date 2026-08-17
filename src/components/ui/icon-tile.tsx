import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Gradients, Palette, Radius, Spacing } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  /** Shows the red attention dot used when a reward is waiting to be claimed. */
  badge?: boolean;
};

/** Square shortcut tile from the menu's quick-access row. */
export function IconTile({ icon, label, onPress, badge = false }: Props) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.05 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
      style={[animatedStyle, { flex: 1 }]}>
      <View style={{ borderRadius: Radius.medium, borderWidth: 2, borderColor: Palette.metalEdge, overflow: 'hidden' }}>
        <LinearGradient colors={Gradients.metal} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ padding: 3 }}>
          <LinearGradient
            colors={Gradients.ink}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              gap: Spacing.one,
              paddingVertical: Spacing.three,
              borderRadius: Radius.small,
              borderWidth: 1,
              borderColor: Palette.inkEdge,
            }}>
            <Ionicons name={icon} size={24} color={Palette.gold} />
            <Text numberOfLines={1} style={{ color: Palette.textPrimary, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 }}>
              {label.toUpperCase()}
            </Text>
          </LinearGradient>
        </LinearGradient>
      </View>

      {badge && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: Palette.danger,
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        />
      )}
    </AnimatedPressable>
  );
}
