import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CoinIcon } from '@/components/ui/coin-badge';
import { GameButton } from '@/components/ui/game-button';
import { InkPlate } from '@/components/ui/metal-panel';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';
import { PlanePreview } from '@/game/plane-preview';
import { SkyPreview, TrailPreview } from '@/game/skin-previews';
import { PLANE_SKINS, SKY_SKINS, TRAIL_SKINS, type SkinKind } from '@/game/skins';
import { adsEnabled, showRewarded } from '@/services/ads';
import { playSfx, vibrate } from '@/services/audio';
import { useGameState } from '@/state/store';

const TABS: { key: SkinKind; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'plane', label: 'Airplane', icon: 'airplane' },
  { key: 'trail', label: 'Trail', icon: 'sparkles' },
  { key: 'sky', label: 'Sky', icon: 'cloud' },
];

const FREE_COINS_AMOUNT = 1000;

function Preview({ kind, id }: { kind: SkinKind; id: string }) {
  if (kind === 'plane') return <PlanePreview skin={PLANE_SKINS.find((s) => s.id === id) ?? PLANE_SKINS[0]} size={96} />;
  if (kind === 'trail') return <TrailPreview skin={TRAIL_SKINS.find((s) => s.id === id) ?? TRAIL_SKINS[0]} />;
  return <SkyPreview skin={SKY_SKINS.find((s) => s.id === id) ?? SKY_SKINS[0]} size={96} />;
}

/** Customize shop body rendered inside a GameDialog, matching the Figma overlay design. */
export function ShopContent() {
  const { save, buySkin, selectSkin, addCoins } = useGameState();
  const [tab, setTab] = useState<SkinKind>('plane');
  const [claimingCoins, setClaimingCoins] = useState(false);

  const items = tab === 'plane' ? PLANE_SKINS : tab === 'trail' ? TRAIL_SKINS : SKY_SKINS;
  const owned = save.ownedSkins[tab];
  const selected = save.selectedSkins[tab];

  const handlePick = (id: string, price: number) => {
    const isOwned = owned.includes(id);
    if (isOwned) {
      selectSkin(tab, id);
      playSfx('tap');
      vibrate('light');
      return;
    }
    if (save.coins < price) {
      vibrate('error');
      return;
    }
    if (buySkin(tab, id)) {
      playSfx('reward');
      vibrate('success');
    }
  };

  const handleFreeCoins = async () => {
    if (claimingCoins) return;
    setClaimingCoins(true);
    const rewarded = await showRewarded('shop_free_coins');
    setClaimingCoins(false);
    if (rewarded) {
      addCoins(FREE_COINS_AMOUNT);
      vibrate('success');
      playSfx('reward');
    }
  };

  return (
    <View>
      {adsEnabled() && (
        <InkPlate style={styles.freeCoinsCard}>
          <Image
            source={require('@/assets/game/ui/rewarded-coins.png')}
            style={styles.freeCoinsArt}
            contentFit="contain"
          />
          <View style={styles.freeCoinsRow}>
            <View style={styles.freeCoinsText}>
              <Text style={[Type.body, styles.freeCoinsTitle]}>Get Free Coins!</Text>
              <Text style={styles.freeCoinsSub}>Watch a video to get:</Text>
            </View>
            <View style={styles.freeCoinsAmount}>
              <CoinIcon size={18} />
              <Text style={styles.freeCoinsValue}>{FREE_COINS_AMOUNT}</Text>
            </View>
          </View>
          <GameButton
            label={claimingCoins ? 'Loading...' : 'Watch Ad'}
            tone="gold"
            disabled={claimingCoins}
            onPress={handleFreeCoins}
            icon={<Ionicons name="videocam" size={18} color={Palette.gold} />}
          />
        </InkPlate>
      )}

      <View style={styles.tabs}>
        {TABS.map((entry) => {
          const active = entry.key === tab;
          return (
            <Pressable
              key={entry.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(entry.key)}
              style={[styles.tab, active && styles.tabActive]}>
              <Ionicons name={entry.icon} size={16} color={active ? Palette.textOnMetal : Palette.textPrimary} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.grid}>
        {items.map((item) => {
          const isOwned = owned.includes(item.id);
          const isSelected = selected === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}${isOwned ? '' : `, ${item.price} coins`}`}
              onPress={() => handlePick(item.id, item.price)}
              style={[styles.card, isSelected && styles.cardSelected]}>
              <View style={tab === 'trail' ? styles.previewSlotTrail : styles.previewSlot}>
                <Preview kind={tab} id={item.id} />
              </View>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              {isSelected ? (
                <View style={styles.selectedPill}>
                  <Ionicons name="checkmark" size={12} color={Palette.textOnMetal} />
                  <Text style={styles.selectedText}>Selected</Text>
                </View>
              ) : isOwned ? (
                <Text style={styles.ownedText}>Owned</Text>
              ) : (
                <View style={styles.priceRow}>
                  <CoinIcon size={12} />
                  <Text style={styles.priceText}>{item.price}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  freeCoinsCard: {
    marginBottom: Spacing.three,
    gap: Spacing.three,
  },
  freeCoinsArt: {
    width: 110,
    height: 110,
    alignSelf: 'center',
  },
  freeCoinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  freeCoinsText: {
    gap: 2,
  },
  freeCoinsTitle: {
    color: Palette.textPrimary,
  },
  freeCoinsSub: {
    color: Palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  freeCoinsAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  freeCoinsValue: {
    color: Palette.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 2,
    borderColor: Palette.metalEdge,
    backgroundColor: 'rgba(10,14,22,0.35)',
  },
  tabActive: {
    backgroundColor: Palette.gold,
    borderColor: Palette.goldDark,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Palette.textPrimary,
  },
  tabLabelActive: {
    color: Palette.textOnMetal,
  },
  scroll: {
    maxHeight: 460,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.three,
  },
  card: {
    width: '48%',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 2,
    borderColor: Palette.metalEdge,
    backgroundColor: 'rgba(10,14,22,0.35)',
  },
  cardSelected: {
    borderColor: Palette.lime,
    backgroundColor: 'rgba(127,198,60,0.18)',
  },
  previewSlot: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSlotTrail: {
    width: '92%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: Palette.gold,
  },
  ownedText: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.textMuted,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Palette.lime,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  selectedText: {
    fontSize: 10,
    fontWeight: '800',
    color: Palette.textOnMetal,
  },
});
