/**
 * The wave-runner simulation.
 *
 * The whole loop runs on the UI thread inside a Reanimated frame callback so the
 * ship never stutters when JavaScript is busy. Only discrete events (crash, win,
 * coin pickup) hop back to JS.
 *
 * Because the ship only ever moves forward, collision state is tracked with
 * monotonically advancing cursors instead of per-object "already handled" flags.
 *
 * The corridor edges double as ground: touching a non-hazard edge clamps the
 * ship onto it (riding the floor/ceiling) instead of ending the run — only a
 * carved triangle (`topHazard`/`bottomHazard`, baked in by `levels.ts`) or an
 * obstacle kills.
 *
 * `react-hooks/immutability` does not model Reanimated's `.value` mutation
 * pattern (a ref-like escape hatch from React's render model, same idea as
 * `useRef().current`) and flags every write in this file as if it mutated React
 * state. It is disabled file-wide rather than at each of the ~15 call sites.
 */

/* eslint-disable react-hooks/immutability -- see file header */

import { useCallback, useMemo } from 'react';
import { runOnJS, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { COIN_RADIUS, SEGMENT_WIDTH, type Level } from '@/game/levels';

export const STATUS_READY = 0;
export const STATUS_RUNNING = 1;
export const STATUS_CRASHED = 2;
export const STATUS_WON = 3;
export const STATUS_PAUSED = 4;

/** Ship collision radius, normalized to playfield height. */
export const SHIP_RADIUS = 0.026;
/** Where the ship sits horizontally on screen, as a fraction of width. */
export const SHIP_SCREEN_X = 0.3;

/**
 * How much of the ship's path history to keep, in world pixels behind its
 * current x. Only ever need enough to cover what's visible behind the ship
 * on screen (`SHIP_SCREEN_X * width`), so this comfortably covers any real
 * device width with room to spare.
 */
const TRAIL_WORLD_SPAN = 500;

/** Max perpendicular deviation (px) a trail point may have from the line through
 *  its neighbors before it's kept as a real corner instead of collapsed away. */
const COLLINEAR_EPS_PX = 0.05;

/** How long the spin-into-the-portal flourish plays before the win dialog appears. */
export const FINISH_OUTRO_MS = 850;

type Callbacks = {
  onCrash: () => void;
  onWin: () => void;
  /** Fires when the ship reaches a `Level.checkpoints` entry; the run pauses there until resumed. */
  onCheckpoint?: (index: number) => void;
  /** Fires once per coin picked up, so JS can play a sfx and drive a live HUD count. */
  onCoin?: () => void;
};

export type WaveEngine = {
  /** Ship position along the course, in world pixels. */
  shipX: SharedValue<number>;
  /** Ship height, normalized to the playfield (0 = top). */
  shipY: SharedValue<number>;
  /** Actual vertical speed last frame (normalized/sec) — differs from the raw
   *  hold/release rate while riding the ground, so the renderer can tilt the
   *  ship to the slope it's actually on rather than the input direction. */
  shipVY: SharedValue<number>;
  /** Recent path history (world x / normalized y), oldest first, trimmed to
   *  `TRAIL_WORLD_SPAN` behind the ship — the renderer traces the trail
   *  ribbon through these exact points. */
  trailX: SharedValue<number[]>;
  trailY: SharedValue<number[]>;
  /** 1 while the player is holding the screen. */
  holding: SharedValue<number>;
  status: SharedValue<number>;
  /** Seconds since the run began. */
  elapsed: SharedValue<number>;
  /** How many of the level's coins have been picked up this run. */
  coinsCollected: SharedValue<number>;
  /** Index of the first coin not yet resolved (collected or passed) — renderer uses this to hide resolved coins. */
  coinCursor: SharedValue<number>;
  /** Where and when the most recent coin was picked up, so the renderer can play
   *  its collect → fly-to-HUD flourish from the exact spot it vanished from:
   *  world x, normalized y, and the `elapsed` stamp (-1 = nothing picked up yet). */
  coinFxX: SharedValue<number>;
  coinFxY: SharedValue<number>;
  coinFxAt: SharedValue<number>;
  start: () => void;
  reset: () => void;
  pause: () => void;
  resume: () => void;
  setHolding: (value: boolean) => void;
  /** Teleports the ship to `x`/`y` (e.g. tutorial Skip, or a checkpoint respawn after a crash),
   *  resetting the trail and per-run cursors, and leaves the run paused there. */
  seek: (x: number, y: number) => void;
};

/**
 * @param level      Course geometry to run.
 * @param playHeight Playfield height in pixels; converts x distances into the
 *                   normalized space used for y so collisions stay circular.
 * @param callbacks  Must be referentially stable (wrap in useCallback).
 */
export function useWaveEngine(level: Level, playHeight: number, callbacks: Callbacks): WaveEngine {
  const shipX = useSharedValue(0);
  const shipY = useSharedValue(0.5);
  const shipVY = useSharedValue(0);
  const trailX = useSharedValue<number[]>([0]);
  const trailY = useSharedValue<number[]>([0.5]);
  const holding = useSharedValue(0);
  const status = useSharedValue<number>(STATUS_READY);
  const elapsed = useSharedValue(0);
  const coinsCollected = useSharedValue(0);

  const obstacleCursor = useSharedValue(0);
  const checkpointCursor = useSharedValue(0);
  const coinCursor = useSharedValue(0);
  const coinFxX = useSharedValue(0);
  const coinFxY = useSharedValue(0);
  const coinFxAt = useSharedValue(-1);

  // Flatten the level into plain number arrays so the worklet closure stays cheap
  // to serialize onto the UI runtime.
  const geometry = useMemo(
    () => ({
      top: level.top,
      bottom: level.bottom,
      topHazard: level.topHazard,
      bottomHazard: level.bottomHazard,
      obstacleX: level.obstacles.map((o) => o.x),
      obstacleY: level.obstacles.map((o) => o.y),
      obstacleR: level.obstacles.map((o) => o.radius),
      coinX: level.coins.map((c) => c.x),
      coinY: level.coins.map((c) => c.y),
      checkpoints: level.checkpoints ?? [],
      length: level.length,
      speed: level.speed,
      climbRate: level.climbRate,
    }),
    [level]
  );

  const { onCrash, onWin, onCheckpoint, onCoin } = callbacks;

  useFrameCallback((frame) => {
    'worklet';
    if (status.value !== STATUS_RUNNING) return;

    // Clamp dt so a dropped frame or a resumed background app cannot teleport the
    // ship through a wall.
    const dt = Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 1 / 30);
    if (dt <= 0) return;

    elapsed.value += dt;

    const prevY = shipY.value;
    const nextX = shipX.value + geometry.speed * dt;
    const direction = holding.value === 1 ? -1 : 1;
    let nextY = prevY + direction * geometry.climbRate * dt;

    shipX.value = nextX;

    // --- Checkpoints: pause the run at each authored waypoint (tutorial only) -
    const nextCheckpointIndex = checkpointCursor.value;
    if (nextCheckpointIndex < geometry.checkpoints.length && nextX >= geometry.checkpoints[nextCheckpointIndex]) {
      shipX.value = geometry.checkpoints[nextCheckpointIndex];
      shipY.value = nextY;
      checkpointCursor.value = nextCheckpointIndex + 1;
      status.value = STATUS_PAUSED;
      if (onCheckpoint) runOnJS(onCheckpoint)(nextCheckpointIndex);
      return;
    }

    if (nextX >= geometry.length) {
      status.value = STATUS_WON;
      runOnJS(onWin)();
      return;
    }

    // --- Corridor walls: ride a plain edge, die on a carved triangle ---------
    const rawIndex = nextX / SEGMENT_WIDTH;
    const index = Math.floor(rawIndex);
    const frac = rawIndex - index;
    const maxIndex = geometry.top.length - 1;
    const i0 = index < 0 ? 0 : index > maxIndex ? maxIndex : index;
    const i1 = i0 + 1 > maxIndex ? maxIndex : i0 + 1;

    const topY = geometry.top[i0] + (geometry.top[i1] - geometry.top[i0]) * frac;
    const bottomY = geometry.bottom[i0] + (geometry.bottom[i1] - geometry.bottom[i0]) * frac;

    if (nextY - SHIP_RADIUS < topY) {
      if (geometry.topHazard[i0] === 1) {
        status.value = STATUS_CRASHED;
        runOnJS(onCrash)();
        return;
      }
      nextY = topY + SHIP_RADIUS;
    }
    if (nextY + SHIP_RADIUS > bottomY) {
      if (geometry.bottomHazard[i0] === 1) {
        status.value = STATUS_CRASHED;
        runOnJS(onCrash)();
        return;
      }
      nextY = bottomY - SHIP_RADIUS;
    }

    shipY.value = nextY;
    shipVY.value = (nextY - prevY) / dt;

    // --- Trail history --------------------------------------------------------
    // Store corners, not samples: collapse the point just pushed into its segment
    // when it's collinear with its neighbors (checked in the same px space the
    // renderer draws in, via playHeight). Without this the history is ~120 points
    // ~10px apart on a ~25px-wide ribbon, which is too dense for TrailRibbon's
    // miter joins to have anywhere to go — this keeps every real corner (still
    // exact, never smoothed away) while turning the ~10px steps between them into
    // long straight legs a miter can actually work with.
    const trailXs = trailX.value;
    const trailYs = trailY.value;
    trailXs.push(nextX);
    trailYs.push(nextY);
    while (trailXs.length >= 3) {
      const last = trailXs.length - 1;
      const ax = trailXs[last - 2];
      const ay = trailYs[last - 2] * playHeight;
      const bx = trailXs[last - 1];
      const by = trailYs[last - 1] * playHeight;
      const cx = trailXs[last];
      const cy = trailYs[last] * playHeight;
      const vx = cx - ax;
      const vy = cy - ay;
      const segLen = Math.sqrt(vx * vx + vy * vy);
      if (segLen < 1e-6) break;
      // Perpendicular distance of the middle point from the a→c line.
      const dist = Math.abs((bx - ax) * vy - (by - ay) * vx) / segLen;
      if (dist > COLLINEAR_EPS_PX) break;
      trailXs.splice(last - 1, 1);
      trailYs.splice(last - 1, 1);
    }

    // Trim history past TRAIL_WORLD_SPAN, but clip the new oldest point exactly to
    // the span boundary (via interpolation) instead of just dropping it — corners
    // are now up to ~170px apart, so a plain drop would yank a whole leg out at
    // once and jump the texture's cumulative-length mapping in TrailRibbon.
    const trailFloor = nextX - TRAIL_WORLD_SPAN;
    let dropCount = 0;
    while (dropCount < trailXs.length - 2 && trailXs[dropCount + 1] <= trailFloor) {
      dropCount += 1;
    }
    if (dropCount > 0) {
      trailXs.splice(0, dropCount);
      trailYs.splice(0, dropCount);
    }
    if (trailXs.length >= 2 && trailXs[0] < trailFloor) {
      const span = trailXs[1] - trailXs[0];
      const t = span > 1e-6 ? (trailFloor - trailXs[0]) / span : 0;
      trailYs[0] = trailYs[0] + (trailYs[1] - trailYs[0]) * t;
      trailXs[0] = trailFloor;
    }

    // --- Obstacles ----------------------------------------------------------
    const obstacleCount = geometry.obstacleX.length;
    let cursor = obstacleCursor.value;
    while (cursor < obstacleCount && geometry.obstacleX[cursor] < nextX - 200) {
      cursor += 1;
    }
    obstacleCursor.value = cursor;

    for (let i = cursor; i < obstacleCount; i += 1) {
      const dxPx = geometry.obstacleX[i] - nextX;
      if (dxPx > 200) break;
      const dx = dxPx / playHeight;
      const dy = geometry.obstacleY[i] - nextY;
      const reach = geometry.obstacleR[i] + SHIP_RADIUS;
      if (dx * dx + dy * dy < reach * reach) {
        status.value = STATUS_CRASHED;
        runOnJS(onCrash)();
        return;
      }
    }

    // --- Coins ----------------------------------------------------------
    // Mirrors the obstacle cursor above but is non-lethal and additive: a
    // coin is "resolved" (collected or missed) the moment the ship reaches
    // its x, and the cursor only ever advances.
    const coinCount = geometry.coinX.length;
    let coinIdx = coinCursor.value;
    while (coinIdx < coinCount) {
      const coinXPx = geometry.coinX[coinIdx];
      if (coinXPx > nextX + 60) break;
      const dxPx = coinXPx - nextX;
      const dx = dxPx / playHeight;
      const dy = geometry.coinY[coinIdx] - nextY;
      const reach = COIN_RADIUS + SHIP_RADIUS;
      if (dx * dx + dy * dy < reach * reach) {
        coinsCollected.value += 1;
        // Hand the renderer the spot this coin vanished from, so its pickup
        // flourish starts exactly where the sprite was.
        coinFxX.value = coinXPx;
        coinFxY.value = geometry.coinY[coinIdx];
        coinFxAt.value = elapsed.value;
        if (onCoin) runOnJS(onCoin)();
        coinIdx += 1;
      } else if (coinXPx < nextX - 60) {
        coinIdx += 1;
      } else {
        break;
      }
    }
    coinCursor.value = coinIdx;
  }, true);

  const reset = useCallback(() => {
    const startY = (level.top[0] + level.bottom[0]) / 2;
    shipX.value = 0;
    shipY.value = startY;
    shipVY.value = 0;
    trailX.value = [0];
    trailY.value = [startY];
    holding.value = 0;
    elapsed.value = 0;
    obstacleCursor.value = 0;
    checkpointCursor.value = 0;
    coinCursor.value = 0;
    coinsCollected.value = 0;
    coinFxAt.value = -1;
    status.value = STATUS_READY;
  }, [
    level,
    shipX,
    shipY,
    shipVY,
    trailX,
    trailY,
    holding,
    elapsed,
    obstacleCursor,
    checkpointCursor,
    coinCursor,
    coinsCollected,
    coinFxAt,
    status,
  ]);

  const start = useCallback(() => {
    if (status.value === STATUS_READY) status.value = STATUS_RUNNING;
  }, [status]);

  const pause = useCallback(() => {
    if (status.value === STATUS_RUNNING) status.value = STATUS_PAUSED;
  }, [status]);

  const resume = useCallback(() => {
    if (status.value === STATUS_PAUSED) status.value = STATUS_RUNNING;
  }, [status]);

  const setHolding = useCallback(
    (value: boolean) => {
      holding.value = value ? 1 : 0;
    },
    [holding]
  );

  const seek = useCallback(
    (x: number, y: number) => {
      shipX.value = x;
      shipY.value = y;
      shipVY.value = 0;
      trailX.value = [x];
      trailY.value = [y];
      holding.value = 0;
      obstacleCursor.value = 0;
      let cursor = 0;
      while (cursor < geometry.checkpoints.length && geometry.checkpoints[cursor] <= x) {
        cursor += 1;
      }
      checkpointCursor.value = cursor;
      let coinCursorAt = 0;
      while (coinCursorAt < geometry.coinX.length && geometry.coinX[coinCursorAt] <= x) {
        coinCursorAt += 1;
      }
      coinCursor.value = coinCursorAt;
      coinFxAt.value = -1;
      status.value = STATUS_PAUSED;
    },
    [
      shipX,
      shipY,
      shipVY,
      trailX,
      trailY,
      holding,
      obstacleCursor,
      checkpointCursor,
      coinCursor,
      coinFxAt,
      status,
      geometry,
    ]
  );

  return {
    shipX,
    shipY,
    shipVY,
    trailX,
    trailY,
    holding,
    status,
    elapsed,
    coinsCollected,
    coinCursor,
    coinFxX,
    coinFxY,
    coinFxAt,
    start,
    reset,
    pause,
    resume,
    setHolding,
    seek,
  };
}
