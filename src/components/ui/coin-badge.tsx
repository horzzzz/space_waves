import { LinearGradient } from 'expo-linear-gradient';
import { Text, type StyleProp, type ViewStyle } from 'react-native';

import { Gradients, Palette, Radius, Spacing } from '@/constants/theme';

/** The silver coin-token glyph reused wherever a currency amount is shown, matching the flat metal disc from the design. */
export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <LinearGradient
      colors={['#F4F6F8', '#C7CCD3', '#9299A3']}
      start={{ x: 0.25, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(1, size * 0.09),
        borderColor: Palette.metalEdge,
      }}
    />
  );
}

export function formatCoins(value: number) {
  return value.toLocaleString('en-US');
}

type Props = {
  amount: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Dark pill showing the player's coin balance, as used in the screen top bars. */
export function CoinBadge({ amount, size = 16, style }: Props) {
  return (
    <LinearGradient
      colors={Gradients.ink}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        {
          height: 36,
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.two,
          paddingHorizontal: Spacing.three,
          borderRadius: Radius.pill,
          borderWidth: 2,
          borderColor: Palette.lime,
        },
        style,
      ]}>
      <CoinIcon size={size} />
      <Text style={{ color: Palette.textPrimary, fontSize: size * 0.85, fontWeight: '800', letterSpacing: 0.4 }}>
        {formatCoins(amount)}
      </Text>
    </LinearGradient>
  );
}
