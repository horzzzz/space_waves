import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { formatCoins } from '@/components/ui/coin-badge';
import { MetalPanel } from '@/components/ui/metal-panel';
import { ScreenFrame } from '@/components/ui/screen-frame';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useGameState } from '@/state/store';

type Row = { rank: number; name: string; amount: number; isYou?: boolean };

/** Row chrome sampled from the Figma "Leaderboards" export. */
const ROW_BG = '#303031';
const CAPTION_COLOR = '#8A8D93';
const YOU_BG = '#119300';

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
    <View style={[styles.row, row.isYou && styles.rowYou]}>
      <View style={styles.rankCol}>
        <Text style={styles.rankNumber}>{row.rank}</Text>
        <Text style={styles.caption}>Number</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {row.name}
      </Text>
      <View style={styles.amountCol}>
        <Text style={styles.amountText}>$ {formatCoins(row.amount)}</Text>
        <Text style={styles.caption}>Withdrawal Amount</Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { save } = useGameState();
  const rows = useMemo(() => buildBoard(save.coins), [save.coins]);

  return (
    <ScreenFrame title="Leaderboards" contentStyle={styles.content}>
      <MetalPanel style={styles.panel} contentStyle={styles.panelContent}>
        <FlatList
          style={styles.list}
          data={rows}
          keyExtractor={(row) => row.name}
          renderItem={({ item }) => <LeaderboardRow row={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </MetalPanel>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.four,
  },
  panel: {
    flex: 1,
  },
  panelContent: {
    flex: 1,
    padding: Spacing.three,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: ROW_BG,
  },
  rowYou: {
    backgroundColor: YOU_BG,
  },
  rankCol: {
    alignItems: 'center',
    minWidth: 30,
  },
  rankNumber: {
    color: Palette.textPrimary,
    fontWeight: '900',
    fontSize: 22,
  },
  caption: {
    color: CAPTION_COLOR,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  name: {
    flex: 1,
    color: Palette.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    color: Palette.textPrimary,
    fontWeight: '900',
    fontSize: 16,
  },
});
