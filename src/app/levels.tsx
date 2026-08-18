import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenFrame } from '@/components/ui/screen-frame';
import { Palette, Spacing } from '@/constants/theme';
import { TOTAL_LEVELS } from '@/game/levels';
import { useGameState } from '@/state/store';

const COLUMNS = 4;

function Stars({ count }: { count: number }) {
  return (
    <View style={styles.stars}>
      {[0, 1, 2].map((index) => (
        <Image
          key={index}
          source={
            index < count
              ? require('@/assets/game/icons/star-filled.png')
              : require('@/assets/game/icons/star-empty.png')
          }
          style={styles.star}
          contentFit="contain"
        />
      ))}
    </View>
  );
}

function LevelTile({
  id,
  unlocked,
  stars,
  onPress,
}: {
  id: number;
  unlocked: boolean;
  stars: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unlocked ? `Level ${id}` : `Level ${id}, locked`}
      accessibilityState={{ disabled: !unlocked }}
      disabled={!unlocked}
      onPress={onPress}
      style={styles.tileWrapper}>
      <View style={styles.tile}>
        <Image
          source={
            unlocked
              ? require('@/assets/game/ui/tile-level-active.png')
              : require('@/assets/game/ui/tile-level-inactive.png')
          }
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
        {unlocked ? (
          <View style={styles.tileContent}>
            <Text style={styles.tileNumber}>{id}</Text>
            <Stars count={stars} />
          </View>
        ) : (
          <View style={styles.tileContentLocked}>
            <Text style={styles.tileNumberLocked}>{id}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function LevelsScreen() {
  const router = useRouter();
  const { starsFor, isLevelUnlocked } = useGameState();

  const levels = Array.from({ length: TOTAL_LEVELS }, (_, index) => index + 1);

  return (
    <ScreenFrame title="Levels">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {levels.map((id) => (
          <LevelTile
            key={id}
            id={id}
            unlocked={isLevelUnlocked(id)}
            stars={starsFor(id)}
            onPress={() => router.push({ pathname: '/game', params: { level: String(id) } })}
          />
        ))}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    justifyContent: 'center',
  },
  tileWrapper: {
    width: `${100 / COLUMNS}%`,
    aspectRatio: 1,
    maxWidth: 88,
    padding: Spacing.half,
  },
  tile: {
    flex: 1,
  },
  tileContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tileContentLocked: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '14%',
    alignItems: 'center',
  },
  tileNumber: {
    color: Palette.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  tileNumberLocked: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '800',
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  star: {
    width: 10,
    height: 10,
  },
});
