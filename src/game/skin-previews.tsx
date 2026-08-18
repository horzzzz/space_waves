import { Image } from 'expo-image';
import { View } from 'react-native';

import { Radius } from '@/constants/theme';
import type { SkySkin, TrailSkin } from '@/game/skins';

/**
 * Small trail thumbnail used for trail previews in the shop. The source art is an
 * extremely elongated strip (~16:1) meant to be stretched along the ship's flight
 * path in gameplay, so a plain `contain` fit shrinks it to an invisible sliver.
 * Instead we crop into the bright arrowhead/glow end with `cover` + right-anchored
 * `contentPosition`, in a wide-but-short box, to read as a bold streak like the design.
 */
export function TrailPreview({ skin }: { skin: TrailSkin }) {
  return (
    <View style={{ width: '100%', height: '100%', borderRadius: Radius.small, overflow: 'hidden' }}>
      <Image
        source={skin.image}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        contentPosition={{ right: 0 }}
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
