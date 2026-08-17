import { PoetsenOne_400Regular } from '@expo-google-fonts/poetsen-one';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { initAds } from '@/services/ads';
import { initAnalytics } from '@/services/analytics';
import { applyAudioSettings, initAudio } from '@/services/audio';
import { GameStateProvider, useGameState } from '@/state/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Keeps the audio layer in sync with the persisted settings toggles. */
function AudioSettingsBridge() {
  const { ready, save } = useGameState();

  useEffect(() => {
    if (!ready) return;
    applyAudioSettings(save.settings);
  }, [ready, save.settings]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ PoetsenOne_400Regular });

  useEffect(() => {
    initAnalytics();
    initAds();
    void initAudio();
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GameStateProvider>
          <AudioSettingsBridge />
          <StatusBar style="light" hidden />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: Palette.screenBase },
            }}
          />
        </GameStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
