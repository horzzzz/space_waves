import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Gradients, Palette, Radius } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  name: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  size?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

/** Small metal-framed square button used for back, pause, settings and close. */
export function IconButton({ name, onPress, size = 40, accessibilityLabel, style }: Props) {
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
      <View
        style={{
          width: size,
          height: size,
          borderRadius: Radius.medium,
          borderWidth: 2,
          borderColor: Palette.metalEdge,
          overflow: 'hidden',
        }}>
        <LinearGradient colors={Gradients.metal} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1, padding: 3 }}>
          <LinearGradient
            colors={Gradients.ink}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: Radius.small,
              borderWidth: 1,
              borderColor: Palette.inkEdge,
            }}>
            <Ionicons name={name} size={size * 0.5} color={Palette.textPrimary} />
          </LinearGradient>
        </LinearGradient>
      </View>
    </AnimatedPressable>
  );
}
