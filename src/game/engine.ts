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

import { SEGMENT_WIDTH, type Level } from '@/game/levels';

export const STATUS_READY = 0;
export const STATUS_RUNNING = 1;
export const STATUS_CRASHED = 2;
export const STATUS_WON = 3;
export const STATUS_PAUSED = 4;

/** Ship collision radius, normalized to playfield height. */
export const SHIP_RADIUS = 0.026;
/** Where the ship sits horizontally on screen, as a fraction of width. */
export const SHIP_SCREEN_X = 0.3;

type Callbacks = {
  onCrash: () => void;
  onWin: () => void;
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
  /** 1 while the player is holding the screen. */
  holding: SharedValue<number>;
  status: SharedValue<number>;
  /** Seconds since the run began. */
  elapsed: SharedValue<number>;
  start: () => void;
  reset: () => void;
  pause: () => void;
  resume: () => void;
  setHolding: (value: boolean) => void;
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
  const holding = useSharedValue(0);
  const status = useSharedValue<number>(STATUS_READY);
  const elapsed = useSharedValue(0);

  const obstacleCursor = useSharedValue(0);

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
      length: level.length,
      speed: level.speed,
      climbRate: level.climbRate,
    }),
    [level]
  );

  const { onCrash, onWin } = callbacks;

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
  }, true);

  const reset = useCallback(() => {
    const startY = (level.top[0] + level.bottom[0]) / 2;
    shipX.value = 0;
    shipY.value = startY;
    shipVY.value = 0;
    holding.value = 0;
    elapsed.value = 0;
    obstacleCursor.value = 0;
    status.value = STATUS_READY;
  }, [level, shipX, shipY, shipVY, holding, elapsed, obstacleCursor, status]);

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

  return {
    shipX,
    shipY,
    shipVY,
    holding,
    status,
    elapsed,
    start,
    reset,
    pause,
    resume,
    setHolding,
  };
}
