import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/ui/brand-logo';
import { CoinBadge, CoinIcon } from '@/components/ui/coin-badge';
import { GameButton } from '@/components/ui/game-button';
import { GameDialog } from '@/components/ui/game-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { IconTile } from '@/components/ui/icon-tile';
import { InkPlate } from '@/components/ui/metal-panel';
import { QuestsContent } from '@/components/ui/quests-content';
import { SettingsContent } from '@/components/ui/settings-content';
import { ShopContent } from '@/components/ui/shop-content';
import { SkyBackground } from '@/components/ui/sky-background';
import { getLegalUrls } from '@/constants/config';
import {DisplayFont, MaxContentWidth, Palette, Spacing, Type} from '@/constants/theme';
import { playMusic, playSfx, vibrate } from '@/services/audio';
import {
  DAILY_BONUS_AMOUNT,
  dailyBonusRemaining,
  hasClaimableQuest,
  useGameState,
  wheelCooldownRemaining,
} from '@/state/store';

export default function MenuScreen() {
  const router = useRouter();
  const { save, claimDailyBonus } = useGameState();
  const [showDaily, setShowDaily] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showQuests, setShowQuests] = useState(false);

  const dailyReady = dailyBonusRemaining(save.lastDailyBonusAt) === 0;
  const wheelReady = wheelCooldownRemaining(save.lastWheelSpinAt) === 0;
  const questsReady = hasClaimableQuest(save);

  useEffect(() => {
    playMusic('menu');
  }, []);

  // Offer the chest on entry, the way the design presents it. The extra render
  // this triggers is intentional: the dialog's visibility is derived from a
  // Date.now() check that can't be known during the initial render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (dailyReady) setShowDaily(true);
  }, [dailyReady]);

  const openLegal = (url: string) => {
    openBrowserAsync(url).catch(() => {});
  };

  const legal = getLegalUrls();

  const handleClaimDaily = () => {
    claimDailyBonus();
    playSfx('reward');
    vibrate('success');
    setShowDaily(false);
  };

  return (
    <SkyBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <IconButton
            icon={require('@/assets/game/icons/settings.png')}
            accessibilityLabel="Settings"
            onPress={() => setShowSettings(true)}
          />
          <View style={styles.spacer} />
          <CoinBadge amount={save.coins} />
        </View>

        <View style={styles.logoSlot}>
          <BrandLogo scale={1.15} />
        </View>

        <View style={styles.actions}>
          <GameButton label="Play" onPress={() => router.push('/mode')} />
          <GameButton label="How to Fly" onPress={() => router.push('/tutorial')} />

          <View style={styles.tileRow}>
            <IconTile
              icon={require('@/assets/game/ui/tile-wheel.png')}
              label="Wheel of Fortune"
              onPress={() => router.push('/wheel')}
              badge={wheelReady}
            />
            <IconTile
              icon={require('@/assets/game/ui/tile-daily-drop.png')}
              label="Daily Drop"
              onPress={() => setShowDaily(true)}
              badge={dailyReady}
            />
            <IconTile
              icon={require('@/assets/game/ui/tile-daily-missions.png')}
              label="Daily Missions"
              onPress={() => setShowQuests(true)}
              badge={questsReady}
            />
            <IconTile
              icon={require('@/assets/game/ui/tile-leaderboard.png')}
              label="Leaderboard"
              onPress={() => router.push('/leaderboard')}
            />
          </View>

          <GameButton
            label="Customize"
            icon={<Ionicons name="construct" size={22} color={Palette.textPrimary} />}
            onPress={() => setShowCustomize(true)}
          />
        </View>

        <Text style={styles.legal}>
          By pressing “Play” you confirm that you are 18+ and accept our{' '}
          <Text style={styles.legalLink} onPress={() => openLegal(legal.termsUrl)}>
            Terms Of Use
          </Text>{' '}
          &{' '}
          <Text style={styles.legalLink} onPress={() => openLegal(legal.privacyUrl)}>
            Privacy Policy
          </Text>
        </Text>
      </SafeAreaView>

      <GameDialog visible={showDaily} title="Daily Bonus!" onClose={() => setShowDaily(false)}>
        <View style={styles.dialogBody}>
          <Image
            source={require('@/assets/game/ui/chest.png')}
            style={styles.chest}
            contentFit="contain"
          />
          <InkPlate>
            <Text style={[Type.body, styles.centered]}>
              {dailyReady ? 'We give you daily bonus!' : 'Come back tomorrow for more!'}
            </Text>
            <View style={styles.amountRow}>
              <CoinIcon size={18} />
              <Text style={[Type.heading, styles.amount]}>{DAILY_BONUS_AMOUNT}</Text>
            </View>
          </InkPlate>
          <GameButton
            label={dailyReady ? 'Claim' : 'Claimed'}
            disabled={!dailyReady}
            onPress={handleClaimDaily}
          />
        </View>
      </GameDialog>

      <GameDialog visible={showSettings} title="Settings" onClose={() => setShowSettings(false)}>
        <SettingsContent />
      </GameDialog>

      <GameDialog visible={showCustomize} title="Customization" onClose={() => setShowCustomize(false)}>
        <ShopContent />
      </GameDialog>

      <GameDialog visible={showQuests} title="Daily Quests" onClose={() => setShowQuests(false)}>
        <QuestsContent />
      </GameDialog>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  spacer: {
    flex: 1,
  },
  logoSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: Spacing.three,
  },
  tileRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  legal: {
    marginTop: Spacing.four,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: Palette.textOnMetal,
    fontFamily: DisplayFont,
  },
  legalLink: {
    textDecorationLine: 'underline',
    color: Palette.textOnMetal,
    fontFamily: DisplayFont,
  },
  dialogBody: {
    gap: Spacing.four,
  },
  chest: {
    width: 140,
    height: 140,
    alignSelf: 'center',
  },
  centered: {
    textAlign: 'center',
    color: Palette.textPrimary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  amount: {
    color: Palette.gold,
  },
});
