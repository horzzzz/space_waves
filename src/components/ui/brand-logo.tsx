import { Image } from 'expo-image';
import { View } from 'react-native';

const LOGO_ASPECT = 1536 / 1024;
const BASE_WIDTH = 280;

/** The real Figma logo lockup, exported to a transparent PNG. */
export function BrandLogo({ scale = 1 }: { scale?: number }) {
  const width = BASE_WIDTH * scale;
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
