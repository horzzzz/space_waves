import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { getSkySkin } from '@/game/skins';
import { useGameState } from '@/state/store';

/**
 * The shared backdrop used behind every non-gameplay screen: the illustrated sky
 * matching the player's equipped sky skin, falling back to the default while the
 * save file is still loading.
 */
export function SkyBackground({ children }: { children?: React.ReactNode }) {
  const { save } = useGameState();
  const sky = getSkySkin(save.selectedSkins.sky);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={sky.image} style={StyleSheet.absoluteFill} contentFit="cover" />
      {children}
    </View>
  );
}
