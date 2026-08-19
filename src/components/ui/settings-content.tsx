import { Image } from 'expo-image';
import { useEffect } from 'react';
import { openBrowserAsync } from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { InkPlate } from '@/components/ui/metal-panel';
import { ToggleRow } from '@/components/ui/toggle-row';
import { getLegalUrls } from '@/constants/config';
import { Palette, Spacing, Type } from '@/constants/theme';
import { reportSettingsOpen } from '@/services/analytics';
import { useGameState } from '@/state/store';

function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.navRow}>
      <Text style={styles.navLabel}>{label}</Text>
      <Image
        source={require('@/assets/game/icons/back.webp')}
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
    <View style={styles.groups}>
      <InkPlate style={styles.group}>
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
      </InkPlate>

      <InkPlate style={styles.group}>
        <NavRow label="Privacy Policy" onPress={() => openBrowserAsync(legal.privacyUrl)} />
        <NavRow label="Terms Of Use" onPress={() => openBrowserAsync(legal.termsUrl)} />
      </InkPlate>
    </View>
  );
}

const styles = StyleSheet.create({
  groups: {
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.four,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  navLabel: {
    ...Type.heading,
    color: Palette.textPrimary,
  },
  navArrow: {
    width: 36,
    height: 36,
    transform: [{ scaleX: -1 }],
  },
});
