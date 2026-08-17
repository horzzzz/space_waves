import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { GameButton } from '@/components/ui/game-button';
import { MetalPanel, InkPlate } from '@/components/ui/metal-panel';
import { ScreenFrame } from '@/components/ui/screen-frame';
import { DisplayFont, MaxContentWidth, Palette, Spacing, Type } from '@/constants/theme';
import { useGameState } from '@/state/store';

const CARD_WIDTH_RATIO = 0.86;
const CARD_GAP = Spacing.three;

export default function ModeScreen() {
  const router = useRouter();
  const { unlockedLevel } = useGameState();
  const { width } = useWindowDimensions();

  const contentWidth = Math.min(width, MaxContentWidth);
  const cardWidth = contentWidth * CARD_WIDTH_RATIO;
  const sidePad = (contentWidth - cardWidth) / 2;

  return (
    <ScreenFrame title="Mode" contentStyle={styles.content}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + CARD_GAP}
        snapToAlignment="start"
        style={styles.pager}
        contentContainerStyle={{ paddingHorizontal: sidePad, gap: CARD_GAP }}>
        <View style={[styles.page, { width: cardWidth }]}>
          <MetalPanel contentStyle={styles.card}>
            <Text style={[Type.title, styles.cardTitle]}>CLASSIC</Text>
            <InkPlate>
              <Text style={[Type.body, styles.cardText]}>Reach the finish to complete levels</Text>
            </InkPlate>
            <GameButton label="Select level" uppercase={false} onPress={() => router.push('/levels')} />
            <GameButton
              label="Start"
              uppercase={false}
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
    fontFamily: DisplayFont,
    fontSize: 20,

  },
  hint: {
    marginTop: Spacing.five,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: DisplayFont,
    color: Palette.textOnMetal,
  },
});
