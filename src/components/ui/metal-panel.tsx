import { LinearGradient } from 'expo-linear-gradient';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Gradients, Palette, Radius, Spacing } from '@/constants/theme';

type Props = {
  children?: React.ReactNode;
  /** Draws the four corner screws seen on the larger panels in the design. */
  screws?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

function Screw({ top, left }: { top?: number; left?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        left,
        right: left === undefined ? Spacing.two : undefined,
        bottom: top === undefined ? Spacing.two : undefined,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Palette.screw,
        borderWidth: 1,
        borderColor: Palette.metalEdge,
      }}
    />
  );
}

/** Brushed-metal container used for every dialog and grouped control in the design. */
export function MetalPanel({ children, screws = true, style, contentStyle }: Props) {
  return (
    <View
      style={[
        {
          borderRadius: Radius.large,
          borderWidth: 2,
          borderColor: Palette.metalEdge,
          overflow: 'hidden',
        },
        style,
      ]}>
      <LinearGradient colors={Gradients.metal} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
        <View
          style={[
            { padding: Spacing.four, borderRadius: Radius.large - 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
            contentStyle,
          ]}>
          {children}
        </View>
        {screws && (
          <>
            <Screw top={Spacing.two} left={Spacing.two} />
            <Screw top={Spacing.two} />
            <Screw left={Spacing.two} />
            <Screw />
          </>
        )}
      </LinearGradient>
    </View>
  );
}

/** Dark recessed plate used for value readouts (coin totals, descriptions). */
export function InkPlate({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={Gradients.ink}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        {
          borderRadius: Radius.medium,
          borderWidth: 2,
          borderColor: Palette.inkEdge,
          paddingHorizontal: Spacing.four,
          paddingVertical: Spacing.three,
        },
        style,
      ]}>
      {children}
    </LinearGradient>
  );
}
