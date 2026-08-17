import { Image } from 'expo-image';
import { useWindowDimensions, View } from 'react-native';

import { MaxContentWidth } from '@/constants/theme';

const LOGO_ASPECT = 1536 / 1024;
/** Logo width as a fraction of the available content width, at scale 1. */
const BASE_FRACTION = 0.72;

/** The real Figma logo lockup, exported to a transparent PNG. Sized relative to the screen so it scales down on small devices instead of overflowing. */
export function BrandLogo({ scale = 1 }: { scale?: number }) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, MaxContentWidth);
  const width = contentWidth * BASE_FRACTION * scale;
  return (
    <View style={{ width, height: width / LOGO_ASPECT }}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
      />
    </View>
  );
}
