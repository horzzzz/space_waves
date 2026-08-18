import { Image } from 'expo-image';
import { useEffect } from 'react';
import { openBrowserAsync } from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ToggleRow } from '@/components/ui/toggle-row';
import { getLegalUrls } from '@/constants/config';
import { Palette, Spacing } from '@/constants/theme';
import { reportSettingsOpen } from '@/services/analytics';
import { useGameState } from '@/state/store';

function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.navRow}>
      <Text style={styles.navLabel}>{label}</Text>
      <Image
        source={require('@/assets/game/icons/back.png')}
        style={styles.navArrow}
        contentFit="contain"
      />
    </Pressable>
  );
}

/** Settings body rendered inside a GameDialog, matching the Figma overlay design. */
export function SettingsContent() {
  const { save, setSetting } = useGameState();
  const legal = getLegalUrls();

  useEffect(() => {
    reportSettingsOpen();
  }, []);

  return (
    <View>
      <ToggleRow label="Music" value={save.settings.music} onValueChange={(value) => setSetting('music', value)} />
      <ToggleRow label="Sound" value={save.settings.sound} onValueChange={(value) => setSetting('sound', value)} />
      <ToggleRow
        label="Vibration"
        value={save.settings.vibration}
        onValueChange={(value) => setSetting('vibration', value)}
      />
      <ToggleRow
        label="Notifications"
        value={save.settings.notifications}
        onValueChange={(value) => setSetting('notifications', value)}
      />

      <View style={styles.divider} />

      <NavRow label="Privacy Policy" onPress={() => openBrowserAsync(legal.privacyUrl)} />
      <NavRow label="Terms Of Use" onPress={() => openBrowserAsync(legal.termsUrl)} />
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginVertical: Spacing.two,
    borderRadius: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  navArrow: {
    width: 28,
    height: 28,
    transform: [{ scaleX: -1 }],
  },
});
