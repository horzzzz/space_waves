import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CoinIcon } from '@/components/ui/coin-badge';
import { GameButton } from '@/components/ui/game-button';
import { InkPlate } from '@/components/ui/metal-panel';
import { Palette, Spacing, Type } from '@/constants/theme';
import { playSfx, vibrate } from '@/services/audio';
import { QUEST_DEFS, type QuestId, useGameState } from '@/state/store';

const QUEST_ORDER: QuestId[] = ['levels', 'stars', 'coins'];

/** Daily quests body rendered inside a GameDialog, matching the Figma overlay design. */
export function QuestsContent() {
  const { save, claimQuest, refreshQuestsIfStale } = useGameState();

  useEffect(() => {
    refreshQuestsIfStale();
  }, [refreshQuestsIfStale]);

  const handleClaim = (id: QuestId) => {
    claimQuest(id);
    playSfx('reward');
    vibrate('success');
  };

  return (
    <View style={styles.list}>
      {QUEST_ORDER.map((id) => {
        const def = QUEST_DEFS[id];
        const progress = Math.min(save.questProgress[id], def.target);
        const claimed = save.questClaimed[id];
        const complete = progress >= def.target;

        return (
          <InkPlate key={id} style={styles.card}>
            <Text style={[Type.body, styles.title]}>{def.title}</Text>
            <View style={styles.row}>
              <Text style={styles.progress}>
                {progress}/{def.target}
              </Text>
              <View style={styles.rewardRow}>
                <CoinIcon size={16} />
                <Text style={styles.rewardValue}>{def.reward}</Text>
              </View>
            </View>
            <GameButton
              label={claimed ? 'Claimed' : complete ? 'Claim' : `${progress}/${def.target}`}
              disabled={claimed || !complete}
              onPress={() => handleClaim(id)}
              compact
            />
          </InkPlate>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.two,
  },
  title: {
    color: Palette.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progress: {
    fontSize: 13,
    fontWeight: '800',
    color: Palette.textMuted,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Palette.gold,
  },
});
