import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { GameButton } from '@/components/ui/game-button';
import { MetalPanel, InkPlate } from '@/components/ui/metal-panel';
import { ScreenFrame } from '@/components/ui/screen-frame';
import { MaxContentWidth, Palette, Spacing, Type } from '@/constants/theme';
import { useGameState } from '@/state/store';

export default function ModeScreen() {
  const router = useRouter();
  const { save, unlockedLevel } = useGameState();
  const { width } = useWindowDimensions();

  const cardWidth = Math.min(width, MaxContentWidth) - Spacing.four * 2;

  return (
    <ScreenFrame title="Mode" coins={save.coins} contentStyle={styles.content}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
        contentContainerStyle={styles.pagerContent}>
        <View style={[styles.page, { width: cardWidth }]}>
          <MetalPanel contentStyle={styles.card}>
            <Text style={[Type.title, styles.cardTitle]}>CLASSIC</Text>
            <InkPlate>
              <Text style={[Type.body, styles.cardText]}>Reach the finish to complete levels</Text>
            </InkPlate>
            <GameButton label="Select level" onPress={() => router.push('/levels')} />
            <GameButton
              label="Start"
              onPress={() => router.push({ pathname: '/game', params: { level: String(unlockedLevel) } })}
            />
          </MetalPanel>
        </View>

        <View style={[styles.page, { width: cardWidth }]}>
          <MetalPanel contentStyle={styles.card}>
            <Text style={[Type.title, styles.cardTitle]}>ENDLESS</Text>
            <InkPlate>
              <Text style={[Type.body, styles.cardText]}>Fly as far as you can. Coming soon.</Text>
            </InkPlate>
            <GameButton label="Locked" disabled />
          </MetalPanel>
        </View>
      </ScrollView>

      <Text style={styles.hint}>Swipe sideways to see more modes</Text>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  pager: {
    flexGrow: 0,
  },
  pagerContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  page: {
    justifyContent: 'center',
  },
  card: {
    gap: Spacing.three,
  },
  cardTitle: {
    textAlign: 'center',
    color: Palette.textOnMetal,
  },
  cardText: {
    textAlign: 'center',
    color: Palette.textPrimary,
  },
  hint: {
    marginTop: Spacing.five,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
