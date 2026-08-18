/**
 * "How to Fly" tutorial course.
 *
 * A single hand-authored `Level` (not procedurally generated like `levels.ts`),
 * split into 4 teaching steps by `Level.checkpoints`: the engine auto-pauses the
 * run at each checkpoint so the tutorial screen can show that step's card and
 * wait for a tap before continuing. Reuses `carveTriangle` from `levels.ts` so
 * the "watch out" step's slopes read as the same carved rock as a real level.
 */

import { SHIP_RADIUS } from '@/game/engine';
import {
  carveTriangle,
  SEGMENT_WIDTH,
  TRIANGLE_PRESETS,
  type Level,
  type Obstacle,
  type ObstacleKind,
  type SpikeVariant,
} from '@/game/levels';

export type TutorialStep = {
  /** Uppercase headline shown above the body on steps 2-4; step 1 has none. */
  title?: string;
  body: string;
  /** Shown at the bottom of the screen while this step is actually flying. */
  hint: string;
};

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    body: 'Hold your finger to fly up.\nRelease to fly down.',
    hint: 'Hold and release',
  },
  {
    title: 'KEEP THE BALANCE',
    body: 'Use short taps for better control.',
    hint: 'Try tapping several times',
  },
  {
    title: 'WATCH OUT!',
    body: 'Avoid spikes, walls and slopes.',
    hint: 'Stay in the air',
  },
  {
    title: 'REACH THE FINISH',
    body: 'Fly to the finish to complete the level.',
    hint: 'Good luck!',
  },
];

/** World-x where each step begins; also where Skip/crash-respawn seek the ship to. */
export const TUTORIAL_STEP_STARTS: readonly number[] = [0, 1800, 3600, 5800];
const TUTORIAL_LENGTH = 7200;
const TUTORIAL_SPEED = 240;
const TUTORIAL_CLIMB_RATE = 0.6;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Corridor half-width (added/subtracted from the 0.5 centerline) per step —
// bigger is a more forgiving, wider corridor. Mirrors the range `levels.ts`
// difficultyFor() uses across the full 40-level curve (0.34 easiest → 0.15 hardest).
const WIDE = 0.34;
const NARROW = 0.22;
const MID = 0.26;

/** Places one wall-mounted obstacle, flush against whichever edge it grows from. */
function pushWallObstacle(
  obstacles: Obstacle[],
  top: number[],
  bottom: number[],
  index: number,
  kind: ObstacleKind,
  spikeVariant: SpikeVariant,
  towardTop: boolean,
  spin: number
) {
  const gap = bottom[index] - top[index];
  const baseRadius = clamp(gap * 0.2, 0.025, 0.06);
  const radius = kind === 'spike' ? baseRadius * 0.6 : baseRadius;
  const y = towardTop ? top[index] + radius * 1.05 : bottom[index] - radius * 1.05;
  obstacles.push({ kind, spikeVariant, x: index * SEGMENT_WIDTH, y, radius, spin, towardTop });
}

function buildTutorialLevel(): Level {
  const sampleCount = Math.ceil(TUTORIAL_LENGTH / SEGMENT_WIDTH) + 2;
  const top = new Array<number>(sampleCount);
  const bottom = new Array<number>(sampleCount);
  const topHazard = new Array<number>(sampleCount).fill(0);
  const bottomHazard = new Array<number>(sampleCount).fill(0);

  // Zone boundaries, in samples. Widths ramp smoothly across a short span rather
  // than stepping, so the wall never jumps under the ship.
  const narrowStart = Math.floor(TUTORIAL_STEP_STARTS[1] / SEGMENT_WIDTH);
  const narrowRampEnd = narrowStart + 10;
  const narrowEnd = Math.floor(TUTORIAL_STEP_STARTS[2] / SEGMENT_WIDTH);
  const midRampEnd = narrowEnd + 10;
  const finishStart = Math.floor(TUTORIAL_STEP_STARTS[3] / SEGMENT_WIDTH);

  for (let i = 0; i < sampleCount; i += 1) {
    let halfWidth: number;
    if (i < narrowStart) {
      halfWidth = WIDE;
    } else if (i < narrowRampEnd) {
      halfWidth = lerp(WIDE, NARROW, clamp01((i - narrowStart) / (narrowRampEnd - narrowStart)));
    } else if (i < narrowEnd) {
      halfWidth = NARROW;
    } else if (i < midRampEnd) {
      halfWidth = lerp(NARROW, MID, clamp01((i - narrowEnd) / (midRampEnd - narrowEnd)));
    } else {
      halfWidth = MID;
    }
    top[i] = 0.5 - halfWidth;
    bottom[i] = 0.5 + halfWidth;
  }

  const obstacles: Obstacle[] = [];

  // --- Step 3 ("watch out"): carved slopes plus a couple of sprite hazards ---
  const triangleSpots: { center: number; size: 'large' | 'medium'; towardTop: boolean }[] = [
    { center: finishStart - 32, size: 'medium', towardTop: true },
    { center: finishStart - 20, size: 'large', towardTop: false },
    { center: finishStart - 8, size: 'medium', towardTop: true },
  ];
  for (const spot of triangleSpots) {
    const preset = TRIANGLE_PRESETS[spot.size];
    const gap = bottom[spot.center] - top[spot.center];
    const maxBite = gap - 4 * SHIP_RADIUS;
    const bite = Math.min(gap * preset.biteRatio, maxBite);
    carveTriangle(top, bottom, topHazard, bottomHazard, spot.center, preset.halfSamples, bite, spot.towardTop);
  }

  pushWallObstacle(obstacles, top, bottom, finishStart - 38, 'spike', 'cone', false, 0);
  pushWallObstacle(obstacles, top, bottom, finishStart - 14, 'fan', 'cluster', true, 2.4);

  obstacles.sort((a, b) => a.x - b.x);

  return {
    id: 0,
    top,
    bottom,
    topHazard,
    bottomHazard,
    obstacles,
    length: TUTORIAL_LENGTH,
    speed: TUTORIAL_SPEED,
    climbRate: TUTORIAL_CLIMB_RATE,
    checkpoints: [...TUTORIAL_STEP_STARTS.slice(1)],
  };
}

let cached: Level | null = null;

/** Returns the tutorial course, building it once and caching it (same idea as `getLevel`). */
export function getTutorialLevel(): Level {
  if (!cached) cached = buildTutorialLevel();
  return cached;
}
