import { Image } from 'expo-image';
import { View } from 'react-native';

import { Radius } from '@/constants/theme';
import type { SkySkin, TrailSkin } from '@/game/skins';

/** Small trail thumbnail used for trail previews in the shop. */
export function TrailPreview({ skin, size = 64 }: { skin: TrailSkin; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={skin.image} style={{ width: size * 0.9, height: size * 0.3 }} contentFit="contain" />
    </View>
  );
}

/** Small sky thumbnail used for sky previews in the shop. */
export function SkyPreview({ skin, size = 64 }: { skin: SkySkin; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: Radius.medium, overflow: 'hidden' }}>
      <Image source={skin.image} style={{ width: '100%', height: '100%' }} contentFit="cover" />
    </View>
  );
}
