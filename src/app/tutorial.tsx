import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

import { TutorialCard } from '@/components/game/tutorial-card';
import { GameButton } from '@/components/ui/game-button';
import { GameDialog } from '@/components/ui/game-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { Palette, Spacing, Type } from '@/constants/theme';
import { FINISH_OUTRO_MS, type WaveEngine, useWaveEngine } from '@/game/engine';
import { GameRenderer } from '@/game/renderer';
import { getPlaneSkin, getSkySkin, getTrailSkin } from '@/game/skins';
import { getTutorialLevel, TUTORIAL_STEP_STARTS, TUTORIAL_STEPS } from '@/game/tutorial';
import { playMusic, playSfx, stopMusic, vibrate } from '@/services/audio';
import { useGameState } from '@/state/store';

type Phase = 'paused' | 'playing' | 'finishing' | 'done';

const LAST_STEP = TUTORIAL_STEPS.length - 1;

export default function TutorialScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { save } = useGameState();

  const level = useMemo(() => getTutorialLevel(), []);
  const plane = getPlaneSkin(save.selectedSkins.plane);
  const trail = getTrailSkin(save.selectedSkins.trail);
  const sky = getSkySkin(save.selectedSkins.sky);

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('paused');
  // Callbacks handed to useWaveEngine must stay referentially stable, so the
  // current step/engine are read through refs rather than closed-over state.
  const stepRef = useRef(step);
  const engineRef = useRef<WaveEngine | null>(null);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const outroT = useSharedValue(0);

  const playOutro = useCallback(() => {
    setPhase('finishing');
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value mutation, not React state (see engine.ts header)
    outroT.value = 0;
    outroT.value = withTiming(1, { duration: FINISH_OUTRO_MS, easing: Easing.in(Easing.cubic) });
    setTimeout(() => setPhase('done'), FINISH_OUTRO_MS);
  }, [outroT]);

  const handleCheckpoint = useCallback((index: number) => {
    playSfx('tap');
    setStep(index + 1);
    setPhase('paused');
  }, []);

  const handleCrash = useCallback(() => {
    playSfx('crash');
    vibrate('error');
    // The tutorial corridor is always symmetric around the vertical center, so
    // the midpoint is a safe respawn spot regardless of where the crash step starts.
    engineRef.current?.seek(TUTORIAL_STEP_STARTS[stepRef.current], 0.5);
    setPhase('paused');
  }, []);

  const handleWin = useCallback(() => {
    playOutro();
  }, [playOutro]);

  const callbacks = useMemo(
    () => ({ onCrash: handleCrash, onWin: handleWin, onCheckpoint: handleCheckpoint }),
    [handleCrash, handleWin, handleCheckpoint]
  );

  const engine = useWaveEngine(level, height, callbacks);
  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  useEffect(() => {
    playMusic('game');
    return () => stopMusic();
  }, []);

  const handlePressIn = () => {
    if (phase === 'paused') {
      engine.start();
      engine.resume();
      setPhase('playing');
    }
    engine.setHolding(true);
  };

  const handlePressOut = () => {
    engine.setHolding(false);
  };

  const handleSkip = () => {
    const current = stepRef.current;
    if (current >= LAST_STEP) {
      playOutro();
      return;
    }
    const next = current + 1;
    engine.setHolding(false);
    engine.seek(TUTORIAL_STEP_STARTS[next], 0.5);
    setStep(next);
    setPhase('paused');
  };

  const goToMenu = () => router.replace('/menu');
  const goToPlay = () => router.replace('/mode');

  const isOverlayOpen = phase === 'finishing' || phase === 'done';
  const currentStep = TUTORIAL_STEPS[step];
  const bottomHint = phase === 'paused' && step === 0 ? 'Tap anywhere to continue' : currentStep.hint;

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
      />

      <Pressable
        accessibilityLabel="Hold to climb"
        style={StyleSheet.absoluteFill}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isOverlayOpen}
      />

      <SafeAreaView style={styles.top} pointerEvents="box-none" edges={['top']}>
        <View style={styles.headerRow} pointerEvents="box-none">
          <IconButton
            icon={require('@/assets/game/icons/back.png')}
            accessibilityLabel="Go back"
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle} numberOfLines={1}>
            HOW TO FLY
          </Text>
          <GameButton label="Skip" compact uppercase={false} onPress={handleSkip} style={styles.skipButton} />
        </View>

        {!isOverlayOpen && (
          <View style={styles.cardSlot} pointerEvents="none">
            <TutorialCard step={step} total={TUTORIAL_STEPS.length} title={currentStep.title} body={currentStep.body} />
          </View>
        )}
      </SafeAreaView>

      {!isOverlayOpen && (
        <SafeAreaView style={styles.bottom} pointerEvents="none" edges={['bottom']}>
          <Text style={styles.bottomHint}>{bottomHint}</Text>
        </SafeAreaView>
      )}

      <GameDialog visible={phase === 'done'} title="Ready to Fly!" dismissable={false}>
        <View style={styles.dialogBody}>
          <Text style={[Type.body, styles.centered]}>
            You have learned the basics — hold to climb, tap short and dodge the hazards.
          </Text>
          <GameButton label="Play" onPress={goToPlay} />
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
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  headerTitle: {
    ...Type.heading,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.two,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  skipButton: {
    alignSelf: 'center',
  },
  cardSlot: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Spacing.six,
  },
  bottomHint: {
    ...Type.heading,
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  dialogBody: {
    gap: Spacing.three,
  },
  centered: {
    textAlign: 'center',
    color: Palette.textPrimary,
  },
});
