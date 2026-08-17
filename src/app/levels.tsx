import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenFrame } from '@/components/ui/screen-frame';
import { Gradients, Palette, Radius, Spacing } from '@/constants/theme';
import { TOTAL_LEVELS } from '@/game/levels';
import { useGameState } from '@/state/store';

const COLUMNS = 4;

function Stars({ count }: { count: number }) {
  return (
    <View style={styles.stars}>
      {[0, 1, 2].map((index) => (
        <Ionicons
          key={index}
          name="star"
          size={9}
          color={index < count ? Palette.gold : 'rgba(255,255,255,0.22)'}
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
      <View style={styles.tileBorder}>
        <LinearGradient colors={Gradients.metal} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.tileFrame}>
          <LinearGradient
            colors={unlocked ? Gradients.ink : ['#5C636D', '#414852']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.tileFace}>
            {unlocked ? (
              <>
                <Text style={styles.tileNumber}>{id}</Text>
                <Stars count={stars} />
              </>
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.75)" />
                <Text style={styles.tileNumberLocked}>{id}</Text>
              </>
            )}
          </LinearGradient>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export default function LevelsScreen() {
  const router = useRouter();
  const { save, starsFor, isLevelUnlocked } = useGameState();

  const levels = Array.from({ length: TOTAL_LEVELS }, (_, index) => index + 1);

  return (
    <ScreenFrame title="Levels" coins={save.coins}>
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
  tileBorder: {
    flex: 1,
    borderRadius: Radius.medium,
    borderWidth: 2,
    borderColor: Palette.metalEdge,
    overflow: 'hidden',
  },
  tileFrame: {
    flex: 1,
    padding: 3,
  },
  tileFace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: Palette.inkEdge,
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
});
