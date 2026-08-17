import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Gradients, MaxContentWidth, Palette, Radius, Spacing, Type } from '@/constants/theme';

/** Reference content width the type scale in `Type.button` was tuned against. */
const REFERENCE_WIDTH = 390;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonTone = 'default' | 'gold' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: ButtonTone;
  /** Optional element rendered before the label, e.g. a video or coin glyph. */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  /** Shows the red attention dot (with a count) used for unread/available notices. */
  badge?: number;
  /** Most labels in the design are all-caps, but some are sentence case as typed — set false to render as-is. */
  uppercase?: boolean;
};

const RAIL_BY_TONE: Record<Exclude<ButtonTone, 'default'>, readonly [string, string, string]> = {
  gold: [Palette.gold, Palette.gold, Palette.goldDark],
  danger: ['#F0776E', Palette.danger, Palette.dangerDark],
};

/**
 * The primary control from the design. `default` tone uses the real button-panel
 * export (green rails baked into the art); `gold`/`danger` fall back to the coded
 * metal/rail chrome since there's no matching art for those yet.
 */
export function GameButton({
  label,
  onPress,
  disabled = false,
  tone = 'default',
  icon,
  style,
  compact = false,
  badge,
  uppercase = true,
}: Props) {
  const pressed = useSharedValue(0);
  const { width: windowWidth } = useWindowDimensions();
  const fontScale = Math.min(1, Math.max(0.8, Math.min(windowWidth, MaxContentWidth) / REFERENCE_WIDTH));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  const content = (
    <>
      {icon}
      <Text
        numberOfLines={1}
        style={[Type.button, { fontSize: (compact ? 15 : Type.button.fontSize) * fontScale }]}>
        {uppercase ? label.toUpperCase() : label}
      </Text>
    </>
  );

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 120 }))}
      style={[animatedStyle, { opacity: disabled ? 0.5 : 1 }, style]}>
      {tone === 'default' ? (
        <View style={{ borderRadius: Radius.medium, overflow: 'hidden' }}>
          <Image
            source={require('@/assets/game/ui/button-panel.png')}
            style={StyleSheet.absoluteFill}
            contentFit="fill"
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: Spacing.two,
              paddingVertical: compact ? Spacing.four : Spacing.six,
              paddingHorizontal: Spacing.five,
            }}>
            {content}
          </View>
        </View>
      ) : (
        <View
          style={{
            borderRadius: Radius.medium,
            borderWidth: 2,
            borderColor: Palette.metalEdge,
            overflow: 'hidden',
          }}>
          <View>
            <Image
              source={require('@/assets/game/ui/metal-texture.png')}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            {/* Top rail */}
            <LinearGradient colors={RAIL_BY_TONE[tone]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ height: 4 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.two, paddingVertical: 3 }}>
              <RailCap />
              <LinearGradient
                colors={Gradients.ink}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: Spacing.two,
                  borderRadius: Radius.small,
                  borderWidth: 1,
                  borderColor: Palette.inkEdge,
                  paddingVertical: compact ? Spacing.two : Spacing.three,
                  paddingHorizontal: Spacing.three,
                }}>
                {content}
              </LinearGradient>
              <RailCap />
            </View>

            {/* Bottom rail */}
            <LinearGradient colors={RAIL_BY_TONE[tone]} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={{ height: 4 }} />
          </View>
        </View>
      )}

      {badge !== undefined && (
        <View
          style={{
            position: 'absolute',
            bottom: -10,
            right: 16,
            minWidth: 26,
            height: 26,
            borderRadius: 13,
            paddingHorizontal: 4,
            backgroundColor: Palette.danger,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>{badge}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

/** The screwed metal end cap that bookends the button face (coded gold/danger tones only). */
function RailCap() {
  return (
    <View style={{ width: 10, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: Palette.screw,
          borderWidth: 1,
          borderColor: Palette.metalEdge,
        }}
      />
    </View>
  );
}
