import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BrandLogo } from '@/components/ui/brand-logo';
import { SkyBackground } from '@/components/ui/sky-background';
import { Gradients, Palette, Radius, Spacing, Type } from '@/constants/theme';
import { useGameState } from '@/state/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Minimum time the loading bar stays up, so it never flashes by. */
const MIN_DURATION_MS = 1800;

export default function LoadingScreen() {
  const router = useRouter();
  const { ready } = useGameState();
  const [barDone, setBarDone] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    progress.value = withTiming(1, { duration: MIN_DURATION_MS, easing: Easing.out(Easing.quad) });
    const timer = setTimeout(() => setBarDone(true), MIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [progress]);

  // Leave only once the save file is loaded and the bar has visibly filled.
  useEffect(() => {
    if (ready && barDone) router.replace('/menu');
  }, [ready, barDone, router]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <SkyBackground>
      <View style={styles.container}>
        <View style={styles.logoSlot}>
          <BrandLogo scale={1.1} />
        </View>

        <View style={styles.loadingSlot}>
          <View style={styles.track}>
            <Animated.View style={[styles.fillWrapper, fillStyle]}>
              <LinearGradient
                colors={Gradients.gold}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <Text style={[Type.heading, styles.label]}>Loading...</Text>
        </View>
      </View>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.six,
  },
  logoSlot: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingSlot: {
    width: '100%',
    maxWidth: 320,
    paddingBottom: Spacing.seven,
    gap: Spacing.three,
  },
  track: {
    height: 18,
    borderRadius: Radius.pill,
    backgroundColor: '#0A1730',
    borderWidth: 2,
    borderColor: '#1E3B66',
    overflow: 'hidden',
  },
  fillWrapper: {
    height: '100%',
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  label: {
    textAlign: 'center',
    color: Palette.textPrimary,
  },
});
