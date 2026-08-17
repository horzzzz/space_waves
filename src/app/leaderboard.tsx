import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { CoinIcon, formatCoins } from '@/components/ui/coin-badge';
import { InkPlate } from '@/components/ui/metal-panel';
import { ScreenFrame } from '@/components/ui/screen-frame';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';
import { useGameState } from '@/state/store';

type Row = { rank: number; name: string; amount: number; isYou?: boolean };

/**
 * There is no backend for this build, so the board is a deterministic mock with
 * the player's own coin total spliced in at the right rank. Swap this for a real
 * fetch once a leaderboard service exists.
 */
const MOCK_NAMES = [
  'NeonFalcon', 'SkyRider', 'CosmicAce', 'WaveHunter', 'AeroKnight',
  'StarDrifter', 'NovaPilot', 'JetStreamer', 'OrbitBlaze', 'MeteorDash',
  'SolarGlide', 'VoidRunner', 'PulsarWing', 'ZenithFlyer', 'CraterDive',
];

function buildBoard(playerCoins: number): Row[] {
  const rows: Row[] = MOCK_NAMES.map((name, index) => ({
    rank: 0,
    name,
    amount: Math.max(500, 100000 - index * 7000 + (index % 3) * 1200),
  }));
  rows.push({ rank: 0, name: 'You', amount: playerCoins, isYou: true });
  rows.sort((a, b) => b.amount - a.amount);
  rows.forEach((row, index) => (row.rank = index + 1));
  return rows;
}

function LeaderboardRow({ row }: { row: Row }) {
  return (
    <InkPlate style={[styles.row, row.isYou && styles.rowYou]}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{row.rank}</Text>
      </View>
      <Text style={[Type.body, styles.name]} numberOfLines={1}>
        {row.name}
      </Text>
      <View style={styles.amountRow}>
        <CoinIcon size={14} />
        <Text style={styles.amountText}>{formatCoins(row.amount)}</Text>
      </View>
    </InkPlate>
  );
}

export default function LeaderboardScreen() {
  const { save } = useGameState();
  const rows = useMemo(() => buildBoard(save.coins), [save.coins]);

  return (
    <ScreenFrame title="Leaderboards" coins={save.coins}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.name}
        renderItem={({ item }) => <LeaderboardRow row={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowYou: {
    borderColor: Palette.lime,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: Radius.small,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: Palette.textPrimary,
    fontWeight: '800',
    fontSize: 12,
  },
  name: {
    flex: 1,
    color: Palette.textPrimary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  amountText: {
    color: Palette.gold,
    fontWeight: '800',
    fontSize: 13,
  },
});
