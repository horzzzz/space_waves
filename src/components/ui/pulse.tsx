import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  /** Peak scale of the pulse. The ad spec asks for an obvious "bigger/smaller" beat. */
  amount?: number;
  periodMs?: number;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Wraps a control in a looping scale pulse. Required by the monetization spec for
 * the wheel spin control and the post-win Boost Reward button so they pull attention.
 */
export function Pulse({ children, amount = 0.06, periodMs = 900, enabled = true, style }: Props) {
  const beat = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      beat.value = withTiming(0, { duration: 150 });
      return;
    }
    beat.value = withRepeat(
      withTiming(1, { duration: periodMs, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [beat, enabled, periodMs]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + beat.value * amount }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
