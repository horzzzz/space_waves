import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CoinIcon } from '@/components/ui/coin-badge';
import { GameButton } from '@/components/ui/game-button';
import { InkPlate } from '@/components/ui/metal-panel';
import { Pulse } from '@/components/ui/pulse';
import { ScreenFrame } from '@/components/ui/screen-frame';
import { Gradients, Palette, Spacing, Type } from '@/constants/theme';
import { adsEnabled, showRewarded } from '@/services/ads';
import { playSfx, vibrate } from '@/services/audio';
import { formatCountdown, useGameState, wheelCooldownRemaining } from '@/state/store';

/** Prize faces, alternating colors as in the design's red/green wheel. */
const PRIZES = [50, 500, 100, 1000, 150, 200, 300, 5000];
const SEGMENT_ANGLE = 360 / PRIZES.length;
const SPIN_DURATION_MS = 2600;

type Phase = 'idle' | 'spinning' | 'result';

export default function WheelScreen() {
  const { save, addCoins, recordWheelSpin } = useGameState();
  const [remaining, setRemaining] = useState(() => wheelCooldownRemaining(save.lastWheelSpinAt));
  const [phase, setPhase] = useState<Phase>('idle');
  const [prize, setPrize] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const rotation = useSharedValue(0);

  const ready = remaining === 0;

  useEffect(() => {
    const timer = setInterval(() => setRemaining(wheelCooldownRemaining(save.lastWheelSpinAt)), 1000);
    return () => clearInterval(timer);
  }, [save.lastWheelSpinAt]);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleSpin = () => {
    if (!ready || phase !== 'idle') return;
    playSfx('tap');
    setPhase('spinning');

    const index = Math.floor(Math.random() * PRIZES.length);
    const target = rotation.value + 360 * 5 + (360 - index * SEGMENT_ANGLE);
    rotation.value = withTiming(target, { duration: SPIN_DURATION_MS, easing: Easing.out(Easing.cubic) });

    setTimeout(() => {
      setPrize(PRIZES[index]);
      setPhase('result');
      recordWheelSpin();
      vibrate('medium');
    }, SPIN_DURATION_MS);
  };

  const handleClaim = async () => {
    if (claiming || prize === null) return;

    // No ad ID configured yet — grant the prize directly rather than showing an
    // ad affordance that can't actually play anything.
    if (!adsEnabled()) {
      addCoins(prize);
      playSfx('reward');
      vibrate('success');
      setPhase('idle');
      setPrize(null);
      return;
    }

    setClaiming(true);
    const rewarded = await showRewarded('wheel_claim');
    setClaiming(false);
    if (rewarded) {
      addCoins(prize);
      playSfx('reward');
      vibrate('success');
    }
    setPhase('idle');
    setPrize(null);
  };

  return (
    <ScreenFrame title="Wheel of Luck" coins={save.coins} contentStyle={styles.content}>
      <View style={styles.stage}>
        <Image source={require('@/assets/game/wheel/pointer.png')} style={styles.pointer} contentFit="contain" />
        <Animated.View style={[styles.wheel, wheelStyle]}>
          <Image
            source={require('@/assets/game/wheel/disc.png')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          {PRIZES.map((value, index) => (
            <View
              key={index}
              style={[styles.segment, { transform: [{ rotate: `${index * SEGMENT_ANGLE}deg` }] }]}>
              <View
                style={[
                  styles.segmentTick,
                  { backgroundColor: index % 2 === 0 ? '#E2453B' : '#4F8E1E' },
                ]}
              />
              <Text style={styles.segmentText}>{value}</Text>
            </View>
          ))}
          <LinearGradient colors={Gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hub} />
        </Animated.View>
      </View>

      {phase === 'result' && prize !== null ? (
        <InkPlate style={styles.resultCard}>
          <Text style={[Type.body, styles.centered]}>You won</Text>
          <View style={styles.prizeRow}>
            <CoinIcon size={22} />
            <Text style={styles.prizeValue}>{prize}</Text>
          </View>
        </InkPlate>
      ) : null}

      <View style={styles.actionSlot}>
        {phase === 'result' ? (
          <Pulse amount={0.05} periodMs={800}>
            <GameButton
              label={adsEnabled() ? (claiming ? 'Loading...' : 'Watch & Claim') : 'Claim'}
              tone="gold"
              disabled={claiming}
              onPress={handleClaim}
              icon={adsEnabled() ? <Ionicons name="videocam" size={18} color={Palette.gold} /> : undefined}
            />
          </Pulse>
        ) : ready ? (
          <View style={styles.spinBlock}>
            <Pulse amount={0.04} periodMs={1100} enabled={phase === 'idle'}>
              <GameButton label={phase === 'spinning' ? 'Spinning...' : 'Spin'} disabled={phase === 'spinning'} onPress={handleSpin} />
            </Pulse>
            <Text style={styles.tapLabel}>Tap</Text>
          </View>
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

const WHEEL_SIZE = 220;

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  stage: {
    width: WHEEL_SIZE + 20,
    height: WHEEL_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: 'center',
  },
  segmentTick: {
    position: 'absolute',
    top: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  segmentText: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  hub: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Palette.goldDark,
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
    width: '100%',
    maxWidth: 280,
  },
  spinBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  tapLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
