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
/** Number of ship positions retained for drawing the trail. */
export const TRAIL_SAMPLES = 40;

type Callbacks = {
  onCrash: () => void;
  onWin: () => void;
};

export type WaveEngine = {
  /** Ship position along the course, in world pixels. */
  shipX: SharedValue<number>;
  /** Ship height, normalized to the playfield (0 = top). */
  shipY: SharedValue<number>;
  /** 1 while the player is holding the screen. */
  holding: SharedValue<number>;
  status: SharedValue<number>;
  /** Seconds since the run began. */
  elapsed: SharedValue<number>;
  /** Ring buffers of recent ship positions, used to draw the trail. */
  trailX: SharedValue<number[]>;
  trailY: SharedValue<number[]>;
  /** Index of the most recently written trail sample. */
  trailHead: SharedValue<number>;
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
  const holding = useSharedValue(0);
  const status = useSharedValue<number>(STATUS_READY);
  const elapsed = useSharedValue(0);

  const obstacleCursor = useSharedValue(0);

  const trailX = useSharedValue<number[]>(new Array(TRAIL_SAMPLES).fill(0));
  const trailY = useSharedValue<number[]>(new Array(TRAIL_SAMPLES).fill(0.5));
  const trailHead = useSharedValue(0);

  // Flatten the level into plain number arrays so the worklet closure stays cheap
  // to serialize onto the UI runtime.
  const geometry = useMemo(
    () => ({
      top: level.top,
      bottom: level.bottom,
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

    const nextX = shipX.value + geometry.speed * dt;
    const direction = holding.value === 1 ? -1 : 1;
    const nextY = shipY.value + direction * geometry.climbRate * dt;

    shipX.value = nextX;
    shipY.value = nextY;

    // Ring buffer written in place. Both the write and the renderer's read happen
    // on the UI thread, so this deliberately skips the per-frame cross-thread sync
    // that reassigning `.value` would trigger.
    const head = (trailHead.value + 1) % TRAIL_SAMPLES;
    trailX.value[head] = nextX;
    trailY.value[head] = nextY;
    trailHead.value = head;

    if (nextX >= geometry.length) {
      status.value = STATUS_WON;
      runOnJS(onWin)();
      return;
    }

    // --- Corridor walls -----------------------------------------------------
    const rawIndex = nextX / SEGMENT_WIDTH;
    const index = Math.floor(rawIndex);
    const frac = rawIndex - index;
    const maxIndex = geometry.top.length - 1;
    const i0 = index < 0 ? 0 : index > maxIndex ? maxIndex : index;
    const i1 = i0 + 1 > maxIndex ? maxIndex : i0 + 1;

    const topY = geometry.top[i0] + (geometry.top[i1] - geometry.top[i0]) * frac;
    const bottomY = geometry.bottom[i0] + (geometry.bottom[i1] - geometry.bottom[i0]) * frac;

    if (nextY - SHIP_RADIUS < topY || nextY + SHIP_RADIUS > bottomY) {
      status.value = STATUS_CRASHED;
      runOnJS(onCrash)();
      return;
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
  }, true);

  const reset = useCallback(() => {
    const startY = (level.top[0] + level.bottom[0]) / 2;
    shipX.value = 0;
    shipY.value = startY;
    holding.value = 0;
    elapsed.value = 0;
    obstacleCursor.value = 0;
    trailX.value = new Array(TRAIL_SAMPLES).fill(0);
    trailY.value = new Array(TRAIL_SAMPLES).fill(startY);
    trailHead.value = 0;
    status.value = STATUS_READY;
  }, [level, shipX, shipY, holding, elapsed, obstacleCursor, trailX, trailY, trailHead, status]);

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
    holding,
    status,
    elapsed,
    trailX,
    trailY,
    trailHead,
    start,
    reset,
    pause,
    resume,
    setHolding,
  };
}
