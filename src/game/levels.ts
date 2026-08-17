/**
 * Level geometry for the wave runner.
 *
 * Levels are generated deterministically from their id, so every player sees the
 * same course and no level data needs to ship as an asset. The difficulty curve is
 * hand-tuned; the seeded noise only shapes the corridor within those bounds.
 *
 * Coordinate convention:
 *  - `x` is world pixels from the start of the level.
 *  - `y` is normalized to the playfield height (0 = top edge, 1 = bottom edge),
 *    which keeps levels identical across screen sizes.
 */

export const TOTAL_LEVELS = 40;

/** Horizontal distance between corridor samples, in world pixels. */
export const SEGMENT_WIDTH = 36;

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
    /** Corridor half-height at its widest, normalized. */
    corridorWidth: lerp(0.34, 0.15, t),
    /** How much the corridor centre wanders. */
    amplitude: lerp(0.1, 0.26, t),
    /** Wave frequency of the centreline. */
    frequency: lerp(0.6, 1.5, t),
    /** Chance per candidate slot that an obstacle is placed. */
    obstacleChance: lerp(0.05, 0.32, t),
    speed: lerp(250, 430, t),
    climbRate: lerp(0.62, 0.86, t),
    length: Math.round(lerp(5200, 12000, t)),
  };
}

function buildLevel(id: number): Level {
  const rng = mulberry32(id * 9973 + 12345);
  const config = difficultyFor(id);

  const sampleCount = Math.ceil(config.length / SEGMENT_WIDTH) + 2;
  const top: number[] = new Array(sampleCount);
  const bottom: number[] = new Array(sampleCount);

  // Two out-of-phase sines give an organic corridor without repeating obviously.
  const phaseA = rng() * Math.PI * 2;
  const phaseB = rng() * Math.PI * 2;
  const freqB = config.frequency * lerp(1.7, 2.6, rng());

  // Pinch points force precise flying; they scale in with difficulty.
  const pinchCount = Math.floor(lerp(1, 7, (id - 1) / (TOTAL_LEVELS - 1)) + rng());
  const pinches = Array.from({ length: pinchCount }, () => ({
    at: lerp(0.15, 0.9, rng()),
    width: lerp(0.04, 0.09, rng()),
    strength: lerp(0.35, 0.62, rng()),
  }));

  for (let i = 0; i < sampleCount; i += 1) {
    const x = i * SEGMENT_WIDTH;
    const progress = x / config.length;
    // Radians along the course; scaled so `frequency` reads as waves per screen.
    const phase = (x / 900) * Math.PI * 2;

    const centre =
      0.5 +
      Math.sin(phase * config.frequency + phaseA) * config.amplitude +
      Math.sin(phase * freqB + phaseB) * config.amplitude * 0.35;

    let halfWidth = config.corridorWidth;
    for (const pinch of pinches) {
      const distance = Math.abs(progress - pinch.at);
      if (distance < pinch.width) {
        // Cosine falloff keeps the narrowing smooth rather than a hard step.
        const falloff = 0.5 + 0.5 * Math.cos((distance / pinch.width) * Math.PI);
        halfWidth *= 1 - pinch.strength * falloff;
      }
    }

    // Ease the corridor open at the very start so the player can settle in.
    const intro = clamp(x / 900, 0, 1);
    halfWidth = lerp(config.corridorWidth * 1.5, halfWidth, intro);

    const safeCentre = clamp(centre, halfWidth + 0.04, 1 - halfWidth - 0.04);
    top[i] = clamp(safeCentre - halfWidth, 0.02, 0.96);
    bottom[i] = clamp(safeCentre + halfWidth, 0.04, 0.98);
  }

  const obstacles: Obstacle[] = [];

  // Candidate slots start after the intro run-up and stop before the finish gate.
  const firstSlot = Math.ceil(1400 / SEGMENT_WIDTH);
  const lastSlot = sampleCount - Math.ceil(600 / SEGMENT_WIDTH);
  const slotStride = 5;

  for (let i = firstSlot; i < lastSlot; i += slotStride) {
    const gap = bottom[i] - top[i];
    if (rng() >= config.obstacleChance || gap <= 0.16) continue;

    const kind: ObstacleKind = rng() < 0.55 ? 'spike' : 'fan';
    // Hug one edge so a clean path always remains through the gap.
    const towardTop = rng() < 0.5;
    const radius = clamp(gap * lerp(0.16, 0.26, rng()), 0.025, 0.06);
    const y = towardTop ? top[i] + radius * 1.25 : bottom[i] - radius * 1.25;
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

  return {
    id,
    top,
    bottom,
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
