import { Image } from 'expo-image';
import { useWindowDimensions, View } from 'react-native';

import { MaxContentWidth } from '@/constants/theme';

const LOGO_ASPECT = 1536 / 1024;
/** Logo width as a fraction of the available content width, at scale 1. */
const BASE_FRACTION = 0.72;

/**
 * The real Figma logo lockup, exported to a transparent image. Sized relative
 * to the screen so it scales down on small devices instead of overflowing.
 * Uses a WebP copy for the in-app render; the PNG original is kept only for
 * the splash-screen config in app.json, which expects a PNG.
 */
export function BrandLogo({ scale = 1 }: { scale?: number }) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, MaxContentWidth);
  const width = contentWidth * BASE_FRACTION * scale;
  return (
    <View style={{ width, height: width / LOGO_ASPECT }}>
      <Image
        source={require('@/assets/images/logo.webp')}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
      />
    </View>
  );
}
