import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BoostReward } from '@/components/game/boost-reward';
import { CoinBadge, CoinIcon } from '@/components/ui/coin-badge';
import { GameButton } from '@/components/ui/game-button';
import { GameDialog } from '@/components/ui/game-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { InkPlate } from '@/components/ui/metal-panel';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';
import { FINISH_OUTRO_MS, useWaveEngine } from '@/game/engine';
import { getLevel, rewardForLevel, starsForRun, TOTAL_COINS_PER_LEVEL, TOTAL_LEVELS } from '@/game/levels';
import { COIN_FX_MS, GameRenderer } from '@/game/renderer';
import { getPlaneSkin, getSkySkin, getTrailSkin } from '@/game/skins';
import { adsEnabled } from '@/services/ads';
import { reportGame } from '@/services/analytics';
import { playMusic, playSfx, stopMusic, vibrate } from '@/services/audio';
import { useGameState } from '@/state/store';

type Phase = 'ready' | 'playing' | 'paused' | 'finishing' | 'won' | 'crashed';

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string }>();
  const { width, height } = useWindowDimensions();
  const { save, completeLevel, addCoins, recordQuestRun } = useGameState();

  const levelId = Math.min(TOTAL_LEVELS, Math.max(1, Number(params.level) || 1));
  const level = useMemo(() => getLevel(levelId), [levelId]);

  const [phase, setPhase] = useState<Phase>('ready');
  /** 0→1 over the finish flourish; drives the ship's spin/shrink/fade into the portal. */
  const outroT = useSharedValue(0);
  /** Live HUD count, mirrored from the engine's shared value — but only once the
   *  picked-up coin has finished flying into the counter (see `handleCoin`). */
  const [coinsCollected, setCoinsCollected] = useState(0);
  /** 0→1→0 kick the counter gives when a coin lands in it. */
  const hudBump = useSharedValue(0);
  /** Pending "coin landed" increments, so a restart can cancel them mid-flight. */
  const coinTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Center of the coin counter in screen px — the flying coin's destination.
   *  Seeded with the counter's nominal spot and refined once it has laid out. */
  const coinTargetX = useSharedValue(width - 64);
  const coinTargetY = useSharedValue(64);
  const counterRef = useRef<View>(null);

  const plane = getPlaneSkin(save.selectedSkins.plane);
  const trail = getTrailSkin(save.selectedSkins.trail);
  const sky = getSkySkin(save.selectedSkins.sky);

  const handleCrash = useCallback(() => {
    setPhase('crashed');
    reportGame('loss');
    playSfx('crash');
    vibrate('error');
  }, []);

  const handleWin = useCallback(() => {
    // Play the spin-into-the-portal flourish before the dialog interrupts it.
    setPhase('finishing');
    reportGame('win');
    playSfx('win');
    vibrate('success');
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value mutation, not React state (see engine.ts header)
    outroT.value = 0;
    outroT.value = withTiming(1, { duration: FINISH_OUTRO_MS, easing: Easing.in(Easing.cubic) });
    setTimeout(() => setPhase('won'), FINISH_OUTRO_MS);
  }, [outroT]);

  const clearCoinTimers = useCallback(() => {
    coinTimers.current.forEach(clearTimeout);
    coinTimers.current = [];
  }, []);

  const handleCoin = useCallback(() => {
    playSfx('tap');
    vibrate('light');
    // The renderer plays the pickup pop and then flies the coin up here, so the
    // number and the counter's kick both wait until it actually lands. Only the
    // display waits — the run's real tally is the engine's `coinsCollected`.
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value mutation, not React state (see engine.ts header)
    hudBump.value = withDelay(
      COIN_FX_MS,
      withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 160 }))
    );
    coinTimers.current.push(setTimeout(() => setCoinsCollected((count) => count + 1), COIN_FX_MS));
  }, [hudBump]);

  /** Measured in window space, which is also canvas space: the game screen is
   *  full-bleed (no header, hidden status bar — see `_layout.tsx`). */
  const measureCoinTarget = useCallback(() => {
    counterRef.current?.measureInWindow((x, y, coinWidth, coinHeight) => {
      coinTargetX.value = x + coinWidth / 2;
      coinTargetY.value = y + coinHeight / 2;
    });
  }, [coinTargetX, coinTargetY]);

  const callbacks = useMemo(
    () => ({ onCrash: handleCrash, onWin: handleWin, onCoin: handleCoin }),
    [handleCrash, handleWin, handleCoin]
  );

  const engine = useWaveEngine(level, height, callbacks);

  const baseReward = rewardForLevel(levelId);

  // Bank progress as soon as the level is cleared. When ads aren't configured the
  // boost offer is hidden entirely (see the "won" dialog below), so there's no
  // BoostReward to settle the base payout — grant it here instead. `completeLevel`
  // and `addCoins` write to the persisted save store, an external system, so this
  // is a genuine effect rather than something derivable during render. Reading the
  // engine's coin count here (after the run has fully stopped) is the final tally.
  const stars = starsForRun(engine.coinsCollected.value);
  useEffect(() => {
    if (phase !== 'won') return;
    completeLevel(levelId, stars);
    recordQuestRun(stars, engine.coinsCollected.value);
    if (!adsEnabled()) addCoins(baseReward);
  }, [phase, levelId, stars, completeLevel, addCoins, baseReward, recordQuestRun, engine.coinsCollected]);

  useEffect(() => {
    playMusic('game');
    return () => stopMusic();
  }, []);

  useEffect(() => clearCoinTimers, [clearCoinTimers]);

  const restart = useCallback(() => {
    engine.reset();
    clearCoinTimers();
    /* eslint-disable react-hooks/immutability -- Reanimated shared-value mutation, not React state (see engine.ts header) */
    outroT.value = 0;
    hudBump.value = 0;
    /* eslint-enable react-hooks/immutability */
    setCoinsCollected(0);
    setPhase('ready');
  }, [engine, outroT, hudBump, clearCoinTimers]);

  // Restart cleanly whenever the level changes (e.g. Next Level).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets run state when navigating to a different level id
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId]);

  const beginRun = () => {
    if (phase !== 'ready') return;
    setPhase('playing');
    reportGame('start');
    engine.start();
  };

  const handlePressIn = () => {
    if (phase === 'ready') beginRun();
    if (phase === 'ready' || phase === 'playing') engine.setHolding(true);
  };

  const handlePressOut = () => {
    engine.setHolding(false);
  };

  const handlePause = () => {
    if (phase !== 'playing') return;
    engine.pause();
    engine.setHolding(false);
    setPhase('paused');
  };

  const handleResume = () => {
    setPhase('playing');
    engine.resume();
  };

  const goToMenu = () => router.replace('/menu');

  const goToNextLevel = () => {
    const next = Math.min(TOTAL_LEVELS, levelId + 1);
    router.replace({ pathname: '/game', params: { level: String(next) } });
  };

  const settleReward = (amount: number) => addCoins(amount);

  const counterStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + hudBump.value * 0.18 }] }));

  const isOverlayOpen = phase === 'paused' || phase === 'finishing' || phase === 'won' || phase === 'crashed';

  return (
    <View style={styles.container}>
      <GameRenderer
        engine={engine}
        level={level}
        width={width}
        height={height}
        plane={plane}
        trail={trail}
        sky={sky}
        outroT={outroT}
        coinTargetX={coinTargetX}
        coinTargetY={coinTargetY}
      />

      {/* Control surface: hold to climb, release to dive. */}
      <Pressable
        accessibilityLabel="Hold to climb"
        style={StyleSheet.absoluteFill}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isOverlayOpen}
      />

      <SafeAreaView style={styles.hud} pointerEvents="box-none" edges={['top']}>
        <View style={styles.hudBar} pointerEvents="box-none">
          <IconButton
            icon={require('@/assets/game/icons/pause.webp')}
            accessibilityLabel="Pause"
            onPress={handlePause}
          />
          <View style={styles.spacer} />
          {(phase === 'ready' || phase === 'playing' || phase === 'paused') && (
            /* The plain wrapper is what gets measured: it keeps a stable frame
               while the inner view scales, and measures reliably as a host view. */
            <View ref={counterRef} onLayout={measureCoinTarget}>
              <Animated.View style={[styles.coinCounter, counterStyle]}>
                <CoinIcon size={16} />
                <Text style={styles.coinCounterText}>
                  {coinsCollected}/{TOTAL_COINS_PER_LEVEL}
                </Text>
              </Animated.View>
            </View>
          )}
        </View>
      </SafeAreaView>

      {phase === 'ready' && (
        <View style={styles.tapHint} pointerEvents="none">
          <Text style={styles.tapHintText}>Tap and hold to fly</Text>
          <Text style={styles.tapHintSub}>Release to dive</Text>
        </View>
      )}

      <GameDialog visible={phase === 'paused'} title="Paused" dismissable={false}>
        <View style={styles.dialogBody}>
          <GameButton label="Play" onPress={handleResume} />
          <GameButton label="Restart" onPress={restart} />
          <GameButton label="Main Menu" onPress={goToMenu} />
        </View>
      </GameDialog>

      <GameDialog visible={phase === 'won'} title="You Win!" dismissable={false}>
        <View style={styles.dialogBody}>
          <Image
            source={require('@/assets/game/scenes/level-complete.webp')}
            style={styles.sceneArt}
            contentFit="contain"
          />
          <InkPlate>
            <Text style={[Type.body, styles.centered]}>
              Level {levelId} complete — {stars} of 3 stars
            </Text>
            <View style={styles.rewardRow}>
              <CoinBadge amount={baseReward} size={18} />
            </View>
          </InkPlate>

          {adsEnabled() && <BoostReward baseAmount={baseReward} onSettled={settleReward} />}

          <GameButton
            label={levelId >= TOTAL_LEVELS ? 'Main Menu' : 'Next Level'}
            onPress={levelId >= TOTAL_LEVELS ? goToMenu : goToNextLevel}
          />
          <GameButton label="Main Menu" onPress={goToMenu} />
        </View>
      </GameDialog>

      <GameDialog visible={phase === 'crashed'} title="You Crashed" dismissable={false}>
        <View style={styles.dialogBody}>
          <Image source={require('@/assets/game/scenes/crash.webp')} style={styles.sceneArt} contentFit="contain" />
          <GameButton label="Restart" onPress={restart} />
          <GameButton label="Main Menu" onPress={goToMenu} />
        </View>
      </GameDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.screenBase,
  },
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  hudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  spacer: {
    flex: 1,
  },
  coinCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Palette.lime,
    backgroundColor: 'rgba(10,14,24,0.55)',
  },
  coinCounterText: {
    color: Palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tapHint: {
    position: 'absolute',
    bottom: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.one,
  },
  tapHintText: {
    ...Type.heading,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tapHintSub: {
    ...Type.body,
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dialogBody: {
    gap: Spacing.three,
  },
  sceneArt: {
    width: '100%',
    height: 160,
    alignSelf: 'center',
  },
  centered: {
    textAlign: 'center',
    color: Palette.textPrimary,
  },
  rewardRow: {
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});
