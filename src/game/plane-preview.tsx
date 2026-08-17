import { Image } from 'expo-image';

import type { PlaneSkin } from '@/game/skins';

/** Static plane thumbnail used by the customization shop. */
export function PlanePreview({ skin, size = 64 }: { skin: PlaneSkin; size?: number }) {
  return <Image source={skin.image} style={{ width: size, height: size }} contentFit="contain" />;
}
