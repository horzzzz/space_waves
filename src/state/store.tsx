import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_SKINS, SKIN_CATALOG, type SkinKind } from '@/game/skins';

const STORAGE_KEY = 'space-waves/save/v1';

/** Wheel of fortune cooldown, fixed at 12 hours by the spec. */
export const WHEEL_COOLDOWN_MS = 12 * 60 * 60 * 1000;
/** Daily bonus chest resets once per day. */
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const DAILY_BONUS_AMOUNT = 1000;

/** Daily quests reset as a set once per day. */
export const QUESTS_RESET_MS = 24 * 60 * 60 * 1000;

export type QuestId = 'levels' | 'stars' | 'coins';

export const QUEST_DEFS: Record<QuestId, { title: string; target: number; reward: number }> = {
  levels: { title: 'Complete 3 levels', target: 3, reward: 100 },
  stars: { title: 'Collect 10 stars', target: 10, reward: 150 },
  coins: { title: 'Collect 20 coins', target: 20, reward: 200 },
};

export type QuestProgress = Record<QuestId, number>;
export type QuestClaimed = Record<QuestId, boolean>;

const INITIAL_QUEST_PROGRESS: QuestProgress = { levels: 0, stars: 0, coins: 0 };
const INITIAL_QUEST_CLAIMED: QuestClaimed = { levels: false, stars: false, coins: false };

export type Settings = {
  music: boolean;
  sound: boolean;
  vibration: boolean;
  notifications: boolean;
};

export type SaveData = {
  coins: number;
  /** Level id to stars earned (1-3). A present key means the level is cleared. */
  progress: Record<string, number>;
  ownedSkins: Record<SkinKind, string[]>;
  selectedSkins: Record<SkinKind, string>;
  settings: Settings;
  lastWheelSpinAt: number | null;
  lastDailyBonusAt: number | null;
  /** When the current daily-quest cycle started; null until the player first triggers a quest action. */
  questsCycleStartAt: number | null;
  questProgress: QuestProgress;
  questClaimed: QuestClaimed;
};

const INITIAL_SAVE: SaveData = {
  coins: 0,
  progress: {},
  ownedSkins: {
    plane: [DEFAULT_SKINS.plane],
    trail: [DEFAULT_SKINS.trail],
    sky: [DEFAULT_SKINS.sky],
  },
  selectedSkins: { ...DEFAULT_SKINS },
  settings: { music: true, sound: true, vibration: true, notifications: true },
  lastWheelSpinAt: null,
  lastDailyBonusAt: null,
  questsCycleStartAt: null,
  questProgress: { ...INITIAL_QUEST_PROGRESS },
  questClaimed: { ...INITIAL_QUEST_CLAIMED },
};

/** Merges a persisted blob into the current shape so older saves keep working. */
function reconcile(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return INITIAL_SAVE;
  const saved = raw as Partial<SaveData>;

  const ownedSkins = { ...INITIAL_SAVE.ownedSkins };
  for (const kind of Object.keys(ownedSkins) as SkinKind[]) {
    const persisted = saved.ownedSkins?.[kind];
    const valid = Array.isArray(persisted)
      ? persisted.filter((id) => SKIN_CATALOG[kind].some((skin) => skin.id === id))
      : [];
    ownedSkins[kind] = Array.from(new Set([...INITIAL_SAVE.ownedSkins[kind], ...valid]));
  }

  const selectedSkins = { ...INITIAL_SAVE.selectedSkins };
  for (const kind of Object.keys(selectedSkins) as SkinKind[]) {
    const persisted = saved.selectedSkins?.[kind];
    if (persisted && ownedSkins[kind].includes(persisted)) {
      selectedSkins[kind] = persisted;
    }
  }

  return {
    coins: Math.max(0, Math.floor(saved.coins ?? 0)),
    progress: saved.progress && typeof saved.progress === 'object' ? saved.progress : {},
    ownedSkins,
    selectedSkins,
    settings: { ...INITIAL_SAVE.settings, ...(saved.settings ?? {}) },
    lastWheelSpinAt: saved.lastWheelSpinAt ?? null,
    lastDailyBonusAt: saved.lastDailyBonusAt ?? null,
    questsCycleStartAt: saved.questsCycleStartAt ?? null,
    questProgress: { ...INITIAL_QUEST_PROGRESS, ...(saved.questProgress ?? {}) },
    questClaimed: { ...INITIAL_QUEST_CLAIMED, ...(saved.questClaimed ?? {}) },
  };
}

/** Rolls the quest cycle over to a fresh one if 24h have passed since it started. */
function freshQuestState(prev: SaveData, now = Date.now()): SaveData {
  if (prev.questsCycleStartAt !== null && now - prev.questsCycleStartAt < QUESTS_RESET_MS) return prev;
  return {
    ...prev,
    questsCycleStartAt: now,
    questProgress: { ...INITIAL_QUEST_PROGRESS },
    questClaimed: { ...INITIAL_QUEST_CLAIMED },
  };
}

/** Whether any quest in this cycle is complete and still unclaimed (drives the menu tile badge). */
export function hasClaimableQuest(save: SaveData, now = Date.now()) {
  if (save.questsCycleStartAt === null || now - save.questsCycleStartAt >= QUESTS_RESET_MS) return false;
  return (Object.keys(QUEST_DEFS) as QuestId[]).some(
    (id) => !save.questClaimed[id] && save.questProgress[id] >= QUEST_DEFS[id].target
  );
}

type GameStateValue = {
  /** False until the save file has been read; the splash screen waits on this. */
  ready: boolean;
  save: SaveData;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  completeLevel: (levelId: number, stars: number) => void;
  buySkin: (kind: SkinKind, id: string) => boolean;
  selectSkin: (kind: SkinKind, id: string) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  recordWheelSpin: () => void;
  claimDailyBonus: () => void;
  recordQuestRun: (stars: number, coinsCollected: number) => void;
  claimQuest: (id: QuestId) => void;
  refreshQuestsIfStale: () => void;
  /** Highest level the player may enter (1-based). */
  unlockedLevel: number;
  starsFor: (levelId: number) => number;
  isLevelUnlocked: (levelId: number) => boolean;
};

const GameStateContext = createContext<GameStateValue | null>(null);

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const [save, setSave] = useState<SaveData>(INITIAL_SAVE);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored) setSave(reconcile(JSON.parse(stored)));
      })
      .catch(() => {
        // A corrupt or unreadable save should not block startup; fall back to defaults.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Roll over a stale quest cycle on boot, so a fresh day shows reset progress
  // even before the player triggers any quest-affecting action.
  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time cycle rollover check on app boot
    setSave((prev) => freshQuestState(prev));
  }, [ready]);

  // Persist on change, coalescing bursts (e.g. coin ticks) into one write.
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(save)).catch(() => {});
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [save, ready]);

  const addCoins = useCallback((amount: number) => {
    if (amount <= 0) return;
    setSave((prev) => ({ ...prev, coins: prev.coins + Math.floor(amount) }));
  }, []);

  const spendCoins = useCallback((amount: number) => {
    let ok = false;
    setSave((prev) => {
      if (prev.coins < amount) return prev;
      ok = true;
      return { ...prev, coins: prev.coins - amount };
    });
    return ok;
  }, []);

  const completeLevel = useCallback((levelId: number, stars: number) => {
    setSave((prev) => {
      const key = String(levelId);
      const best = Math.max(prev.progress[key] ?? 0, stars);
      if (prev.progress[key] === best) return prev;
      return { ...prev, progress: { ...prev.progress, [key]: best } };
    });
  }, []);

  const buySkin = useCallback((kind: SkinKind, id: string) => {
    let ok = false;
    setSave((prev) => {
      const skin = SKIN_CATALOG[kind].find((entry) => entry.id === id);
      if (!skin || prev.ownedSkins[kind].includes(id) || prev.coins < skin.price) return prev;
      ok = true;
      return {
        ...prev,
        coins: prev.coins - skin.price,
        ownedSkins: { ...prev.ownedSkins, [kind]: [...prev.ownedSkins[kind], id] },
        selectedSkins: { ...prev.selectedSkins, [kind]: id },
      };
    });
    return ok;
  }, []);

  const selectSkin = useCallback((kind: SkinKind, id: string) => {
    setSave((prev) => {
      if (!prev.ownedSkins[kind].includes(id)) return prev;
      return { ...prev, selectedSkins: { ...prev.selectedSkins, [kind]: id } };
    });
  }, []);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSave((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
  }, []);

  const recordWheelSpin = useCallback(() => {
    setSave((prev) => ({ ...prev, lastWheelSpinAt: Date.now() }));
  }, []);

  const claimDailyBonus = useCallback(() => {
    setSave((prev) => ({
      ...prev,
      coins: prev.coins + DAILY_BONUS_AMOUNT,
      lastDailyBonusAt: Date.now(),
    }));
  }, []);

  const recordQuestRun = useCallback((stars: number, coinsCollected: number) => {
    setSave((prev) => {
      const fresh = freshQuestState(prev);
      return {
        ...fresh,
        questProgress: {
          levels: fresh.questProgress.levels + 1,
          stars: fresh.questProgress.stars + Math.max(0, stars),
          coins: fresh.questProgress.coins + Math.max(0, coinsCollected),
        },
      };
    });
  }, []);

  const claimQuest = useCallback((id: QuestId) => {
    setSave((prev) => {
      const fresh = freshQuestState(prev);
      const def = QUEST_DEFS[id];
      if (fresh.questClaimed[id] || fresh.questProgress[id] < def.target) return fresh;
      return {
        ...fresh,
        coins: fresh.coins + def.reward,
        questClaimed: { ...fresh.questClaimed, [id]: true },
      };
    });
  }, []);

  const refreshQuestsIfStale = useCallback(() => {
    setSave((prev) => freshQuestState(prev));
  }, []);

  const unlockedLevel = useMemo(() => {
    const cleared = Object.keys(save.progress)
      .map(Number)
      .filter((id) => Number.isFinite(id));
    return cleared.length === 0 ? 1 : Math.max(...cleared) + 1;
  }, [save.progress]);

  const starsFor = useCallback((levelId: number) => save.progress[String(levelId)] ?? 0, [save.progress]);

  const isLevelUnlocked = useCallback((levelId: number) => levelId <= unlockedLevel, [unlockedLevel]);

  const value = useMemo<GameStateValue>(
    () => ({
      ready,
      save,
      addCoins,
      spendCoins,
      completeLevel,
      buySkin,
      selectSkin,
      setSetting,
      recordWheelSpin,
      claimDailyBonus,
      recordQuestRun,
      claimQuest,
      refreshQuestsIfStale,
      unlockedLevel,
      starsFor,
      isLevelUnlocked,
    }),
    [
      ready,
      save,
      addCoins,
      spendCoins,
      completeLevel,
      buySkin,
      selectSkin,
      setSetting,
      recordWheelSpin,
      claimDailyBonus,
      recordQuestRun,
      claimQuest,
      refreshQuestsIfStale,
      unlockedLevel,
      starsFor,
      isLevelUnlocked,
    ]
  );

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) throw new Error('useGameState must be used inside GameStateProvider');
  return context;
}

/** Milliseconds until the wheel can be spun again, or 0 when it is ready. */
export function wheelCooldownRemaining(lastSpinAt: number | null, now = Date.now()) {
  if (lastSpinAt === null) return 0;
  return Math.max(0, lastSpinAt + WHEEL_COOLDOWN_MS - now);
}

/** Milliseconds until the daily chest can be claimed again, or 0 when it is ready. */
export function dailyBonusRemaining(lastClaimAt: number | null, now = Date.now()) {
  if (lastClaimAt === null) return 0;
  return Math.max(0, lastClaimAt + DAILY_BONUS_COOLDOWN_MS - now);
}

/** Formats a duration as HH:MM:SS for the cooldown readouts. */
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}
