/**
 * Post-win reward boost.
 *
 * Implements the sequence required by the monetization spec:
 *   win payout shown → after 2s a pulsing "Boost Reward" button with a video glyph
 *   → a 1.5s mini wheel of x1–x10 multipliers → the boosted total with a "Claim!"
 *   button → rewarded video → payout.
 *
 * The boosted amount is only granted when the video actually reports a reward.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CoinIcon } from '@/components/ui/coin-badge';
import { GameButton } from '@/components/ui/game-button';
import { Pulse } from '@/components/ui/pulse';
import { Gradients, Palette, Radius, Spacing, Type } from '@/constants/theme';
import { showRewarded } from '@/services/ads';
import { playSfx, vibrate } from '@/services/audio';

/** Wheel faces, weighted so the big multipliers stay rare. */
const MULTIPLIERS = [1, 2, 3, 5, 10, 2, 3, 5];
const SEGMENT_ANGLE = 360 / MULTIPLIERS.length;
const SPIN_DURATION_MS = 1500;
const OFFER_DELAY_MS = 2000;

type Phase = 'waiting' | 'offer' | 'spinning' | 'result' | 'claimed';

type Props = {
  baseAmount: number;
  /** Called with the final payout once the player has settled the boost. */
  onSettled: (amount: number) => void;
};

export function BoostReward({ baseAmount, onSettled }: Props) {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [multiplier, setMultiplier] = useState(1);
  const [busy, setBusy] = useState(false);
  const rotation = useSharedValue(0);
  const settled = useRef(false);

  // The spec asks for the boost offer to appear two seconds after the win.
  useEffect(() => {
    const timer = setTimeout(() => setPhase((current) => (current === 'waiting' ? 'offer' : current)), OFFER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const settle = (amount: number) => {
    if (settled.current) return;
    settled.current = true;
    onSettled(amount);
  };

  const handleBoost = () => {
    if (phase !== 'offer') return;
    setPhase('spinning');
    playSfx('tap');

    const index = Math.floor(Math.random() * MULTIPLIERS.length);
    // Four full turns, then bring the chosen segment under the top pointer.
    const target = 360 * 4 + (360 - index * SEGMENT_ANGLE);

    rotation.value = withTiming(target, {
      duration: SPIN_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });

    setTimeout(() => {
      setMultiplier(MULTIPLIERS[index]);
      setPhase('result');
      vibrate('medium');
      playSfx('reward');
    }, SPIN_DURATION_MS);
  };

  const handleClaim = async () => {
    if (busy) return;
    setBusy(true);
    const rewarded = await showRewarded('boost_reward');
    setBusy(false);
    setPhase('claimed');
    // No reward earned means no boost: the player still keeps the base payout.
    settle(rewarded ? baseAmount * multiplier : baseAmount);
  };

  if (phase === 'waiting' || phase === 'claimed') {
    return (
      <View style={styles.placeholder}>
        {phase === 'waiting' && <Text style={styles.hint}>Counting your reward...</Text>}
      </View>
    );
  }

  if (phase === 'offer') {
    return (
      <Pulse amount={0.05} periodMs={800}>
        <GameButton
          label="Boost Reward"
          tone="gold"
          onPress={handleBoost}
          icon={<Ionicons name="videocam" size={18} color={Palette.gold} />}
        />
      </Pulse>
    );
  }

  return (
    <View style={styles.wheelBlock}>
      <View style={styles.wheelStage}>
        <Image source={require('@/assets/game/wheel/pointer.png')} style={styles.pointer} contentFit="contain" />
        <Animated.View style={[styles.wheel, wheelStyle]}>
          <Image
            source={require('@/assets/game/wheel/disc.png')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          {MULTIPLIERS.map((value, index) => (
            <View
              key={index}
              style={[styles.segment, { transform: [{ rotate: `${index * SEGMENT_ANGLE}deg` }] }]}>
              <Text style={styles.segmentText}>x{value}</Text>
            </View>
          ))}
          <LinearGradient colors={Gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hub} />
        </Animated.View>

        {phase === 'result' && (
          <View style={styles.resultOverlay} pointerEvents="none">
            <View style={styles.resultPill}>
              <CoinIcon size={16} />
              <Text style={styles.resultText}>{(baseAmount * multiplier).toLocaleString('en-US')}</Text>
            </View>
          </View>
        )}
      </View>

      {phase === 'result' && (
        <Pulse amount={0.05} periodMs={800}>
          <GameButton
            label={busy ? 'Loading...' : 'Claim!'}
            tone="gold"
            disabled={busy}
            onPress={handleClaim}
            icon={<Ionicons name="videocam" size={18} color={Palette.gold} />}
          />
        </Pulse>
      )}
    </View>
  );
}

const WHEEL_SIZE = 150;

const styles = StyleSheet.create({
  placeholder: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    ...Type.caption,
    color: Palette.textOnMetal,
  },
  wheelBlock: {
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  wheelStage: {
    height: WHEEL_SIZE + 16,
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
    paddingTop: 10,
  },
  segmentText: {
    color: Palette.gold,
    fontSize: 14,
    fontWeight: '900',
  },
  hub: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: Palette.goldDark,
  },
  pointer: {
    position: 'absolute',
    top: -4,
    zIndex: 2,
    width: 20,
    height: 26,
  },
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(10,14,22,0.92)',
    borderWidth: 2,
    borderColor: Palette.gold,
  },
  resultText: {
    color: Palette.gold,
    fontSize: 18,
    fontWeight: '900',
  },
});
