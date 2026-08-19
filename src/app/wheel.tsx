import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CoinIcon } from '@/components/ui/coin-badge';
import { GameButton } from '@/components/ui/game-button';
import { InkPlate } from '@/components/ui/metal-panel';
import { Pulse } from '@/components/ui/pulse';
import { ScreenFrame } from '@/components/ui/screen-frame';
import { MaxContentWidth, Palette, Spacing, Type } from '@/constants/theme';
import { adsEnabled, showRewarded } from '@/services/ads';
import { playSfx, vibrate } from '@/services/audio';
import { formatCountdown, useGameState, wheelCooldownRemaining } from '@/state/store';

type Segment =
  | { type: 'coins'; value: number }
  | { type: 'fail' }
  | { type: 'freeSpins'; value: number };

/**
 * Wheel faces, in the same clockwise order (starting at 12 o'clock) as the
 * segments baked into `assets/game/wheel/WHEEL.png`. Keep this in sync with
 * that art if it's ever re-exported.
 */
const SEGMENTS: Segment[] = [
  { type: 'coins', value: 10000 },
  { type: 'coins', value: 100 },
  { type: 'fail' },
  { type: 'coins', value: 500 },
  { type: 'coins', value: 1000 },
  { type: 'coins', value: 200 },
  { type: 'freeSpins', value: 3 },
  { type: 'coins', value: 300 },
  { type: 'fail' },
  { type: 'coins', value: 5000 },
  { type: 'coins', value: 150 },
  { type: 'coins', value: 800 },
];

const SEGMENT_ANGLE = 360 / SEGMENTS.length;
const SPIN_DURATION_MS = 2600;

type Phase = 'idle' | 'spinning' | 'result';

export default function WheelScreen() {
  const { save, addCoins, recordWheelSpin } = useGameState();
  const { width: windowWidth } = useWindowDimensions();
  const [remaining, setRemaining] = useState(() => wheelCooldownRemaining(save.lastWheelSpinAt));
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Segment | null>(null);
  const [freeSpins, setFreeSpins] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const rotation = useSharedValue(0);

  const contentWidth = Math.min(windowWidth, MaxContentWidth) - Spacing.four * 2;
  const wheelSize = Math.min(contentWidth, 380);

  const ready = (remaining === 0 || freeSpins > 0) && phase === 'idle';

  useEffect(() => {
    const timer = setInterval(() => setRemaining(wheelCooldownRemaining(save.lastWheelSpinAt)), 1000);
    return () => clearInterval(timer);
  }, [save.lastWheelSpinAt]);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleSpin = () => {
    if (!ready) return;
    playSfx('tap');
    setPhase('spinning');

    const usingFreeSpin = freeSpins > 0;
    if (usingFreeSpin) {
      setFreeSpins((count) => count - 1);
    } else {
      recordWheelSpin();
    }

    const index = Math.floor(Math.random() * SEGMENTS.length);
    const target = rotation.value + 360 * 5 + (360 - index * SEGMENT_ANGLE);
    rotation.value = withTiming(target, { duration: SPIN_DURATION_MS, easing: Easing.out(Easing.cubic) });

    setTimeout(() => {
      setResult(SEGMENTS[index]);
      setPhase('result');
      vibrate('medium');
    }, SPIN_DURATION_MS);
  };

  const handleClaim = async () => {
    if (claiming || result === null) return;

    if (result.type === 'fail') {
      setPhase('idle');
      setResult(null);
      return;
    }

    if (result.type === 'freeSpins') {
      setFreeSpins((count) => count + result.value);
      playSfx('reward');
      vibrate('success');
      setPhase('idle');
      setResult(null);
      return;
    }

    // No ad ID configured yet — grant the prize directly rather than showing an
    // ad affordance that can't actually play anything.
    if (!adsEnabled()) {
      addCoins(result.value);
      playSfx('reward');
      vibrate('success');
      setPhase('idle');
      setResult(null);
      return;
    }

    setClaiming(true);
    const rewarded = await showRewarded('wheel_claim');
    setClaiming(false);
    if (rewarded) {
      addCoins(result.value);
      playSfx('reward');
      vibrate('success');
    }
    setPhase('idle');
    setResult(null);
  };

  const claimLabel =
    result?.type === 'fail'
      ? 'Continue'
      : result?.type === 'freeSpins'
        ? 'Claim'
        : adsEnabled()
          ? claiming
            ? 'Loading...'
            : 'Watch & Claim'
          : 'Claim';

  return (
    <ScreenFrame title="Wheel of Luck" contentStyle={styles.content}>
      <View style={[styles.stage, { width: wheelSize + 20, height: wheelSize + 20 }]}>
        <Image source={require('@/assets/game/wheel/pointer.webp')} style={styles.pointer} contentFit="contain" />
        <Animated.View style={[{ width: wheelSize, height: wheelSize }, wheelStyle]}>
          <Image
            source={require('@/assets/game/wheel/WHEEL.webp')}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
          />
        </Animated.View>
      </View>

      {phase === 'result' && result !== null ? (
        <InkPlate style={styles.resultCard}>
          {result.type === 'fail' ? (
            <Text style={[Type.body, styles.centered]}>No luck this time</Text>
          ) : result.type === 'freeSpins' ? (
            <Text style={styles.prizeValue}>{result.value} Free Spins!</Text>
          ) : (
            <>
              <Text style={[Type.body, styles.centered]}>You won</Text>
              <View style={styles.prizeRow}>
                <CoinIcon size={22} />
                <Text style={styles.prizeValue}>{result.value}</Text>
              </View>
            </>
          )}
        </InkPlate>
      ) : null}

      <View style={[styles.actionSlot, { width: wheelSize }]}>
        {phase === 'result' ? (
          <Pulse amount={0.05} periodMs={800}>
            <GameButton
              label={claimLabel}
              tone="gold"
              disabled={claiming}
              onPress={handleClaim}
              style={styles.fullWidthButton}
              icon={
                result?.type === 'coins' && adsEnabled() ? (
                  <Ionicons name="videocam" size={18} color={Palette.gold} />
                ) : undefined
              }
            />
          </Pulse>
        ) : ready || phase === 'spinning' ? (
          <Pulse amount={0.04} periodMs={1100} enabled={phase === 'idle'}>
            <GameButton
              label={phase === 'spinning' ? 'Spinning...' : 'Spin'}
              disabled={phase === 'spinning'}
              onPress={handleSpin}
              style={styles.fullWidthButton}
            />
          </Pulse>
        ) : (
          <View style={styles.cooldownBlock}>
            <InkPlate>
              <Text style={styles.cooldownText}>{formatCountdown(remaining)}</Text>
            </InkPlate>
          </View>
        )}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointer: {
    position: 'absolute',
    top: -6,
    zIndex: 2,
    width: 26,
    height: 34,
  },
  resultCard: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
    color: Palette.textPrimary,
  },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  prizeValue: {
    color: Palette.gold,
    fontSize: 26,
    fontWeight: '900',
  },
  actionSlot: {
    minHeight: 80,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  fullWidthButton: {
    width: '100%',
  },
  cooldownBlock: {
    alignItems: 'center',
  },
  cooldownText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    color: Palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
