/**
 * Level geometry for the wave runner.
 *
 * Levels are generated deterministically from their id, so every player sees the
 * same course and no level data needs to ship as an asset. The difficulty curve is
 * hand-tuned; the seeded noise only shapes obstacle placement within those bounds.
 *
 * The corridor floor and ceiling are always flat, straight lines — no hills, no
 * pinches. The ship can safely ride along either one at any time, except where a
 * large or medium triangle has been carved straight into that wall's own edge
 * samples (`topHazard`/`bottomHazard`) — those are always deadly.
 *
 * Coordinate convention:
 *  - `x` is world pixels from the start of the level.
 *  - `y` is normalized to the playfield height (0 = top edge, 1 = bottom edge),
 *    which keeps levels identical across screen sizes.
 */

export const TOTAL_LEVELS = 40;

/** Horizontal distance between corridor samples, in world pixels. */
export const SEGMENT_WIDTH = 36;

/** Ship collision radius, normalized to playfield height. Must match engine.ts's SHIP_RADIUS. */
const SHIP_RADIUS = 0.026;

export type ObstacleKind = 'spike' | 'fan';
/** Which spike artwork to draw; ignored for fans. */
export type SpikeVariant = 'cluster' | 'cone';

export type Obstacle = {
  kind: ObstacleKind;
  spikeVariant: SpikeVariant;
  x: number;
  y: number;
  /** Collision radius, normalized to playfield height. */
  radius: number;
  /** Radians per second; drives the fan blades and is ignored by spikes. */
  spin: number;
  /** True when the obstacle grows from the top wall (art mirrors for the bottom). */
  towardTop: boolean;
};

export type Level = {
  id: number;
  /** Corridor edges sampled every SEGMENT_WIDTH pixels, normalized. */
  top: number[];
  bottom: number[];
  /** 1 where touching that edge kills (a carved triangle), 0 where the ship can ride it. */
  topHazard: number[];
  bottomHazard: number[];
  obstacles: Obstacle[];
  /** Total course length in world pixels. */
  length: number;
  /** Forward speed in pixels per second. */
  speed: number;
  /** Vertical speed in normalized units per second (the 45-degree wave feel). */
  climbRate: number;
};

/** Small deterministic PRNG so a level id always yields the same course. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Difficulty knobs for a level, interpolated along the 40-level curve. */
function difficultyFor(id: number) {
  // 0 at level 1, 1 at the final level.
  const t = clamp((id - 1) / (TOTAL_LEVELS - 1), 0, 1);
  return {
    /** Corridor half-height, normalized — the whole floor/ceiling gap for the level. */
    corridorWidth: lerp(0.34, 0.15, t),
    /** Chance per candidate slot that a fan/spike sprite obstacle is placed. */
    obstacleChance: lerp(0.4, 0.65, t),
    /** Chance per candidate slot that a triangle gets carved into a wall. */
    triangleChance: lerp(0.25, 0.5, t),
    /** Chance per carved triangle that a fan spawns right on its tip. */
    tipFanChance: 0.35,
    speed: lerp(250, 430, t),
    climbRate: lerp(0.62, 0.86, t),
    length: Math.round(lerp(5200, 12000, t)),
  };
}

type TriangleSize = 'large' | 'medium';

/** Half-width (in samples) and how deep into the gap each size bites. */
const TRIANGLE_PRESETS: Record<TriangleSize, { halfSamples: number; biteRatio: number }> = {
  large: { halfSamples: 6, biteRatio: 0.6 },
  medium: { halfSamples: 4, biteRatio: 0.4 },
};

/**
 * Bites a single triangular spike straight into a wall's own edge samples —
 * the *same* stone texture and tiling the rest of the wall uses (the renderer
 * draws the whole wall from one continuous tiled fill clipped to this
 * polyline, and the same rim stroke runs along the edge), so the shape reads
 * as a seamless continuation of the rock, not a pasted sprite.
 *
 * Peaks at `center` and eases to a point at both ends, matching a hand-carved
 * spike rather than a stepped block.
 */
function carveTriangle(
  top: number[],
  bottom: number[],
  topHazard: number[],
  bottomHazard: number[],
  center: number,
  halfSamples: number,
  bite: number,
  towardTop: boolean
) {
  const s0 = Math.max(0, center - halfSamples);
  const s1 = Math.min(top.length - 1, center + halfSamples);

  for (let i = s0; i <= s1; i += 1) {
    const t = halfSamples > 0 ? Math.abs(i - center) / halfSamples : 0;
    const localBite = bite * (1 - t);

    if (towardTop) {
      top[i] += localBite;
      topHazard[i] = 1;
    } else {
      bottom[i] -= localBite;
      bottomHazard[i] = 1;
    }
  }
}

/** Where a triangle ended up — `center` is its peak, the deepest bitten sample. */
type CarvedTriangle = { center: number; towardTop: boolean };

/**
 * Scatters large/medium triangle spikes onto the flat walls. Never lets a
 * bite close the corridor past what the ship needs to squeeze through, and
 * never overlaps another triangle. Returns where each one landed so a fan
 * can optionally be perched on its tip afterwards.
 */
function buildTriangles(
  rng: () => number,
  config: ReturnType<typeof difficultyFor>,
  top: number[],
  bottom: number[],
  topHazard: number[],
  bottomHazard: number[]
): CarvedTriangle[] {
  const sampleCount = top.length;
  const firstSlot = Math.ceil(500 / SEGMENT_WIDTH);
  const lastSlot = sampleCount - Math.ceil(600 / SEGMENT_WIDTH);
  const slotStride = 5;
  const triangles: CarvedTriangle[] = [];

  let cursor = firstSlot;
  while (cursor < lastSlot) {
    if (rng() >= config.triangleChance) {
      cursor += slotStride;
      continue;
    }

    const size: TriangleSize = rng() < 0.5 ? 'large' : 'medium';
    const preset = TRIANGLE_PRESETS[size];
    const s0 = cursor - preset.halfSamples;
    const s1 = cursor + preset.halfSamples;
    if (s0 < firstSlot || s1 >= lastSlot) {
      cursor += slotStride;
      continue;
    }

    let clear = true;
    for (let i = s0; i <= s1; i += 1) {
      if (topHazard[i] === 1 || bottomHazard[i] === 1) {
        clear = false;
        break;
      }
    }
    if (!clear) {
      cursor += slotStride;
      continue;
    }

    const towardTop = rng() < 0.5;
    const gap = bottom[cursor] - top[cursor];
    // Always leave the ship's own width plus a passage clear on the far side.
    const maxBite = gap - 4 * SHIP_RADIUS;
    if (maxBite < 0.05) {
      cursor += slotStride;
      continue;
    }
    const bite = Math.min(gap * preset.biteRatio, maxBite);

    carveTriangle(top, bottom, topHazard, bottomHazard, cursor, preset.halfSamples, bite, towardTop);
    triangles.push({ center: cursor, towardTop });

    cursor = s1 + slotStride;
  }

  return triangles;
}

function buildLevel(id: number): Level {
  const rng = mulberry32(id * 9973 + 12345);
  const config = difficultyFor(id);

  const sampleCount = Math.ceil(config.length / SEGMENT_WIDTH) + 2;

  // Flat corridor: floor and ceiling hold one constant value for the whole
  // level — no ramps, no pinches, just a straight rideable line either side,
  // until buildTriangles bites a hazard into it.
  const halfWidth = config.corridorWidth;
  const topValue = clamp(0.5 - halfWidth, 0.02, 0.96);
  const bottomValue = clamp(0.5 + halfWidth, 0.04, 0.98);
  const top: number[] = new Array(sampleCount).fill(topValue);
  const bottom: number[] = new Array(sampleCount).fill(bottomValue);
  const topHazard: number[] = new Array(sampleCount).fill(0);
  const bottomHazard: number[] = new Array(sampleCount).fill(0);

  const triangles = buildTriangles(rng, config, top, bottom, topHazard, bottomHazard);

  const obstacles: Obstacle[] = [];

  // Candidate slots start after the intro run-up and stop before the finish gate.
  const firstSlot = Math.ceil(500 / SEGMENT_WIDTH);
  const lastSlot = sampleCount - Math.ceil(600 / SEGMENT_WIDTH);
  const slotStride = 4;
  // A sprite is visually wider than one sample, so keep it clear of a carved
  // triangle's whole span, not just the exact slot — otherwise it can sit
  // half over an already-bitten (lower) stretch of wall and look unmounted.
  const hazardClearance = 4;

  for (let i = firstSlot; i < lastSlot; i += slotStride) {
    let nearHazard = false;
    for (let k = -hazardClearance; k <= hazardClearance; k += 1) {
      const s = i + k;
      if (s < 0 || s >= sampleCount) continue;
      if (topHazard[s] === 1 || bottomHazard[s] === 1) {
        nearHazard = true;
        break;
      }
    }
    if (nearHazard) continue;

    const gap = bottom[i] - top[i];
    if (rng() >= config.obstacleChance || gap <= 0.16) continue;

    const kind: ObstacleKind = rng() < 0.55 ? 'spike' : 'fan';
    // Hug one edge, flush with no gap to the wall art (see ObstacleSprite in
    // renderer.tsx for how "flush" stays exact despite each sprite's own
    // aspect ratio) — slightly embedded rather than exactly tangent, so
    // rounding never leaves a hairline gap.
    const towardTop = rng() < 0.5;
    const baseRadius = clamp(gap * lerp(0.16, 0.26, rng()), 0.025, 0.06);
    // Cones/clusters read as visually oversized at full scale — shrink them
    // 40%; fans stay full size.
    const radius = kind === 'spike' ? baseRadius * 0.6 : baseRadius;
    const y = towardTop ? top[i] + radius * 1.05 : bottom[i] - radius * 1.05;
    obstacles.push({
      kind,
      spikeVariant: rng() < 0.5 ? 'cluster' : 'cone',
      x: i * SEGMENT_WIDTH,
      y,
      radius,
      spin: kind === 'fan' ? lerp(1.6, 4.2, rng()) * (rng() < 0.5 ? -1 : 1) : 0,
      towardTop,
    });
  }

  // Fans only: a chance to perch right on a carved triangle's own tip — cones
  // and clusters stay excluded from triangles via the hazardClearance check
  // above.
  for (const triangle of triangles) {
    if (rng() >= config.tipFanChance) continue;

    const gap = bottom[triangle.center] - top[triangle.center];
    if (gap <= 0.16) continue;

    const radius = clamp(gap * lerp(0.16, 0.26, rng()), 0.025, 0.06);
    // Centered exactly on the peak, not hugging it like a wall-mounted sprite.
    const y = triangle.towardTop ? top[triangle.center] : bottom[triangle.center];

    obstacles.push({
      kind: 'fan',
      spikeVariant: rng() < 0.5 ? 'cluster' : 'cone',
      x: triangle.center * SEGMENT_WIDTH,
      y,
      radius,
      spin: lerp(1.6, 4.2, rng()) * (rng() < 0.5 ? -1 : 1),
      towardTop: triangle.towardTop,
    });
  }

  // Tip fans were appended after the slot-scan obstacles regardless of world
  // position, so the array isn't in ascending-x order anymore. The engine's
  // per-frame collision cursor only ever moves forward and assumes ascending
  // x — out of order entries get permanently skipped once the cursor passes
  // them, which is why flying through a tip fan could pass clean through.
  obstacles.sort((a, b) => a.x - b.x);

  return {
    id,
    top,
    bottom,
    topHazard,
    bottomHazard,
    obstacles,
    length: config.length,
    speed: config.speed,
    climbRate: config.climbRate,
  };
}

const cache = new Map<number, Level>();

/** Returns the geometry for a level, building and caching it on first use. */
export function getLevel(id: number): Level {
  const clamped = clamp(Math.round(id), 1, TOTAL_LEVELS);
  let level = cache.get(clamped);
  if (!level) {
    level = buildLevel(clamped);
    cache.set(clamped, level);
  }
  return level;
}

/** Every finished run earns a full 3 stars. */
export function starsForRun() {
  return 3;
}

/** Coin payout for clearing a level, shown on the Level Complete dialog. */
export function rewardForLevel(levelId: number) {
  return 100 + Math.floor(levelId * 5);
}
