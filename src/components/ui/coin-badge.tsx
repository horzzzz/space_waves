import { LinearGradient } from 'expo-linear-gradient';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Gradients, Palette, Radius, Spacing } from '@/constants/theme';

/** The gold coin glyph reused wherever a currency amount is shown. */
export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <LinearGradient
      colors={Gradients.gold}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(1, size * 0.08),
        borderColor: Palette.goldDark,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size * 0.21,
          borderWidth: Math.max(1, size * 0.07),
          borderColor: 'rgba(255,255,255,0.75)',
        }}
      />
    </LinearGradient>
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
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.two,
          paddingHorizontal: Spacing.three,
          paddingVertical: Spacing.one + 2,
          borderRadius: Radius.pill,
          borderWidth: 2,
          borderColor: Palette.inkEdge,
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
