import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { Radius } from '@/constants/theme';
import type { SkySkin, TrailSkin } from '@/game/skins';

/** Small gradient swatch used for trail thumbnails in the shop. */
export function TrailPreview({ skin, size = 64 }: { skin: TrailSkin; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient
        colors={[skin.colors[1], skin.colors[0]]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width: size * 0.8, height: size * 0.22, borderRadius: Radius.pill }}
      />
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
