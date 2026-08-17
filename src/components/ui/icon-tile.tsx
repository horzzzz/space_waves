import { Image, type ImageSource } from 'expo-image';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Palette } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TILE_ASPECT = 273 / 351;

type Props = {
  icon: ImageSource;
  label: string;
  onPress: () => void;
  /** Shows the red attention dot used when a reward is waiting to be claimed. */
  badge?: boolean;
};

/** Square shortcut tile from the menu's quick-access row. The Figma export bakes the frame, icon and label into one card. */
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
      style={[animatedStyle, { flex: 1, aspectRatio: TILE_ASPECT }]}>
      <Image source={icon} style={{ width: '100%', height: '100%' }} contentFit="contain" />

      {badge && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: Palette.danger,
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        />
      )}
    </AnimatedPressable>
  );
}
