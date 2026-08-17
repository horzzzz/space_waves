import { Image } from 'expo-image';
import { Pressable, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  icon: ImageSourcePropType;
  onPress?: () => void;
  size?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Small square button. The Figma export already bakes the metal frame, rails and
 * screws into the icon art, so this is just the glyph plus the press animation.
 */
export function IconButton({ icon, onPress, size = 44, accessibilityLabel, style }: Props) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.06 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
      style={[animatedStyle, style]}>
      <Image source={icon} style={{ width: size, height: size }} contentFit="contain" />
    </AnimatedPressable>
  );
}
