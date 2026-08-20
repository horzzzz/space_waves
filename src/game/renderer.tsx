/**
 * Skia renderer for the gameplay scene.
 *
 * Everything that varies per frame is produced inside `useDerivedValue`, so the
 * React tree is completely static and no re-render happens while playing. Groups
 * of objects (obstacles, coins, clouds) are batched into a single path each rather
 * than mounting one component per object, which keeps the component count fixed
 * regardless of how many things are on screen.
 */

import {
  Canvas,
  Circle,
  Group,
  Image as SkiaImage,
  ImageShader,
  LinearGradient,
  Path,
  Skia,
  useImage,
  vec,
  Vertices,
  type DataSourceParam,
  type SkImage,
  type SkPoint,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { SHIP_RADIUS, SHIP_SCREEN_X, type WaveEngine } from '@/game/engine';
import { COIN_RADIUS, SEGMENT_WIDTH, type Coin, type Level, type Obstacle } from '@/game/levels';
import type { PlaneSkin, SkySkin, TrailSkin } from '@/game/skins';

type Props = {
  engine: WaveEngine;
  level: Level;
  width: number;
  height: number;
  plane: PlaneSkin;
  trail: TrailSkin;
  sky: SkySkin;
  /** 0→1 over the finish flourish; spins/shrinks/fades the ship into the portal. */
  outroT: SharedValue<number>;
  /** Screen-space center of the HUD coin counter — where a picked-up coin flies to.
   *  Optional because the tutorial mounts this renderer too and has no coins
   *  (`tutorial.ts`) nor a counter; it falls back to the top-right corner. */
  coinTargetX?: SharedValue<number>;
  coinTargetY?: SharedValue<number>;
};

/** Pickup flourish: how long the coin pops and flips in place before it takes off. */
export const COIN_POP_MS = 260;
/** …and how long the flight from there into the HUD counter takes. */
export const COIN_FLY_MS = 460;
/** Total time from touching a coin to it landing in the counter. */
export const COIN_FX_MS = COIN_POP_MS + COIN_FLY_MS;

/** How high the pop lifts the coin, in coin radii. */
const COIN_POP_RISE = 1.6;
/** Horizontal squash at the coin's edge-on moment. Never 0, or the transform
 *  collapses the sprite to a degenerate zero-width matrix. */
const COIN_FLIP_MIN = 0.12;
/** How long the pickup's expanding ring flash lasts. */
const COIN_RING_MS = 220;

/** Parallax clouds are laid out once per level from a fixed pattern. */
const CLOUD_PATTERN = [
  { x: 220, y: 0.16, r: 34 },
  { x: 620, y: 0.72, r: 46 },
  { x: 1080, y: 0.3, r: 28 },
  { x: 1520, y: 0.58, r: 40 },
  { x: 2040, y: 0.2, r: 36 },
  { x: 2460, y: 0.8, r: 30 },
];
const CLOUD_SPAN = 2800;
const CLOUD_PARALLAX = 0.35;

/** Size of one stone tile, in px — roughly ~6x SEGMENT_WIDTH. */
const WALL_TILE_SIZE = 220;

export function GameRenderer({
  engine,
  level,
  width,
  height,
  plane,
  trail,
  sky,
  outroT,
  coinTargetX,
  coinTargetY,
}: Props) {
  const { shipX, shipY, shipVY, trailX, trailY, elapsed, coinCursor, coinFxX, coinFxY, coinFxAt } = engine;

  // Stand-ins for a screen without a coin counter (see the props above).
  const fallbackCoinTargetX = useSharedValue(width - 64);
  const fallbackCoinTargetY = useSharedValue(64);

  const shipRadiusPx = SHIP_RADIUS * height;
  const shipScreenX = width * SHIP_SCREEN_X;
  // +3 covers the -1 lead-in tile from the wrap math below, the fractional-camera
  // partial tile at each edge, and one spare.
  const wallTileCount = Math.ceil(width / WALL_TILE_SIZE) + 3;

  /** World x at the left edge of the screen. */
  const cameraX = useDerivedValue(() => shipX.value - shipScreenX);

  // --- Corridor walls -------------------------------------------------------
  const wallsPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const camera = cameraX.value;
    const lastIndex = level.top.length - 1;
    const first = Math.max(0, Math.floor(camera / SEGMENT_WIDTH) - 1);
    const last = Math.min(lastIndex, Math.ceil((camera + width) / SEGMENT_WIDTH) + 1);
    if (last <= first) return path;

    const xAt = (i: number) => i * SEGMENT_WIDTH - camera;

    // Top wall: hug the ceiling, run along the corridor edge, close back up.
    path.moveTo(xAt(first), -2);
    for (let i = first; i <= last; i += 1) path.lineTo(xAt(i), level.top[i] * height);
    path.lineTo(xAt(last), -2);
    path.close();

    // Bottom wall: mirrored against the floor.
    path.moveTo(xAt(first), height + 2);
    for (let i = first; i <= last; i += 1) path.lineTo(xAt(i), level.bottom[i] * height);
    path.lineTo(xAt(last), height + 2);
    path.close();

    return path;
  });

  /** The inner corridor edge, stroked to give the rock a lit rim. */
  const wallEdgePath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const camera = cameraX.value;
    const lastIndex = level.top.length - 1;
    const first = Math.max(0, Math.floor(camera / SEGMENT_WIDTH) - 1);
    const last = Math.min(lastIndex, Math.ceil((camera + width) / SEGMENT_WIDTH) + 1);
    if (last <= first) return path;

    const xAt = (i: number) => i * SEGMENT_WIDTH - camera;

    path.moveTo(xAt(first), level.top[first] * height);
    for (let i = first; i <= last; i += 1) path.lineTo(xAt(i), level.top[i] * height);
    path.moveTo(xAt(first), level.bottom[first] * height);
    for (let i = first; i <= last; i += 1) path.lineTo(xAt(i), level.bottom[i] * height);

    return path;
  });

  const stoneImage = useImage(require('@/assets/game/walls/stone.webp'));

  // --- Obstacles ------------------------------------------------------------
  const fanImage = useImage(require('@/assets/game/obstacles/fan.webp'));
  const spikeClusterImage = useImage(require('@/assets/game/obstacles/spike-cluster.webp'));
  const spikeConeImage = useImage(require('@/assets/game/obstacles/spike-cone.webp'));

  // --- Parallax clouds ------------------------------------------------------
  const cloudsPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const camera = cameraX.value * CLOUD_PARALLAX;
    const cycle = Math.floor(camera / CLOUD_SPAN);

    // Draw the pattern twice so it wraps seamlessly across the screen edge.
    for (let repeat = 0; repeat <= 1; repeat += 1) {
      const offset = (cycle + repeat) * CLOUD_SPAN;
      for (const cloud of CLOUD_PATTERN) {
        const screenX = cloud.x + offset - camera;
        if (screenX < -160 || screenX > width + 160) continue;
        const y = cloud.y * height;
        path.addCircle(screenX, y, cloud.r);
        path.addCircle(screenX + cloud.r * 0.9, y + cloud.r * 0.2, cloud.r * 0.75);
        path.addCircle(screenX - cloud.r * 0.85, y + cloud.r * 0.25, cloud.r * 0.62);
      }
    }

    return path;
  });

  // --- Ship -----------------------------------------------------------------
  const shipImage = useImage(plane.image as DataSourceParam);
  const shipWidth = shipRadiusPx * 3.4;
  const shipAspect = shipImage ? shipImage.width() / shipImage.height() : 1.37;
  const shipHeight = shipWidth / shipAspect;

  // --- Trail ------------------------------------------------------------
  const trailImage = useImage(trail.image as DataSourceParam);
  const trailRadiusPx = shipRadiusPx * 0.55;

  const shipTransform = useDerivedValue(() => {
    // Tilt to the ship's actual vertical speed (not the raw hold/release input)
    // so it flies level while riding the ground instead of nosing down.
    const rise = shipVY.value * height;
    const angle = Math.atan2(rise, level.speed);
    const t = outroT.value;
    // Geometry-Dash-style outro: spin up, shrink, and keep flying forward off
    // the edge of the screen instead of just stopping dead on the finish line.
    const spin = t * Math.PI * 2.5;
    const scale = Math.max(0.1, 1 - t * 0.9);
    const forward = t * width * 0.55;
    return [
      { translateX: shipScreenX + forward },
      { translateY: shipY.value * height },
      { rotate: angle + spin },
      { scale },
    ];
  });

  /** Ship fades out over the back half of the outro so it doesn't hard-cut. */
  const shipOpacity = useDerivedValue(() => 1 - Math.max(0, outroT.value - 0.55) / 0.45);

  const skyImage = useImage(sky.image as DataSourceParam);

  return (
    <Canvas style={{ width, height }}>
      {/* Sky: a static backdrop behind the scrolling corridor, not tied to the camera. */}
      {skyImage && <SkiaImage image={skyImage} x={0} y={0} width={width} height={height} fit="cover" />}

      <Path path={cloudsPath} color="rgba(255,255,255,0.55)" />

      {/* Corridor */}
      {stoneImage && (
        <Group clip={wallsPath}>
          {Array.from({ length: wallTileCount }, (_, index) => (
            <WallStoneTile key={index} index={index} cameraX={cameraX} height={height} image={stoneImage} />
          ))}
        </Group>
      )}
      <Path path={wallEdgePath} style="stroke" strokeWidth={3} color="rgba(255,255,255,0.35)" />

      {level.obstacles.map((obstacle, index) => (
        <ObstacleSprite
          key={index}
          obstacle={obstacle}
          cameraX={cameraX}
          elapsed={elapsed}
          height={height}
          fanImage={fanImage}
          spikeClusterImage={spikeClusterImage}
          spikeConeImage={spikeConeImage}
        />
      ))}

      {level.coins.map((coin, index) => (
        <CoinSprite key={index} coin={coin} index={index} cameraX={cameraX} coinCursor={coinCursor} height={height} />
      ))}

      {/* Trail, drawn before the ship so the ship sits on top of it */}
      {trailImage && (
        <TrailRibbon trailX={trailX} trailY={trailY} cameraX={cameraX} height={height} radiusPx={trailRadiusPx} image={trailImage} />
      )}

      <Group transform={shipTransform} opacity={shipOpacity}>
        {shipImage && (
          <SkiaImage
            image={shipImage}
            x={-shipWidth / 2}
            y={-shipHeight / 2}
            width={shipWidth}
            height={shipHeight}
            fit="contain"
          />
        )}
      </Group>

      {/* Pickup flourish, drawn last so a collected coin flies over everything. */}
      <CollectedCoinFx
        coinFxX={coinFxX}
        coinFxY={coinFxY}
        coinFxAt={coinFxAt}
        elapsed={elapsed}
        cameraX={cameraX}
        targetX={coinTargetX ?? fallbackCoinTargetX}
        targetY={coinTargetY ?? fallbackCoinTargetY}
        height={height}
        radiusPx={COIN_RADIUS * height}
      />
    </Canvas>
  );
}

type TrailRibbonProps = {
  trailX: SharedValue<number[]>;
  trailY: SharedValue<number[]>;
  cameraX: SharedValue<number>;
  height: number;
  radiusPx: number;
  image: SkImage;
};

/** Above this miter ratio (how many ribbon-widths the joint would need to
 *  extend along the legs) the corner switches from a true point to a bevel —
 *  in practice the ship's fixed ±climbRate turn angle never gets close to this,
 *  so every real in-game corner is drawn as an exact miter, never a bevel. */
const TRAIL_MITER_LIMIT = 4;

/**
 * The ship's actual path, retraced as a ribbon mesh and textured with the
 * trail skin's own art stretched along it — the *entire* source image maps
 * once onto whatever length of history is currently on screen (tail end at
 * the oldest point, bright/pointed end at the ship), rather than tiling it
 * repeatedly, so the art's own built-in fade reads correctly no matter how
 * the path bends.
 *
 * `engine.ts` now hands this only real corners (collinear points collapsed
 * away), so each joint below is a genuine, usually-sharp angle rather than a
 * ~10px wobble — the naive "average the two neighboring directions" normal
 * the previous version used can't correctly join a wide ribbon at a sharp
 * angle: at the actual turn angles this course produces, it left the joint
 * both underextended (a visible neck) *and* self-overlapping on the inside
 * of the turn (a visible tear), because two independently-offset points share
 * no vertex there for the strip to pivot on. Each interior point below instead
 * gets a proper line-join: the inside of the turn is a single shared vertex
 * (the exact intersection of the two segments' inner edges, so nothing
 * overlaps), and the outside is either one true miter point — extended just
 * far enough along the bisector to meet both segments' outer edges exactly —
 * or, only if that extension would eat more than half of the shorter leg or
 * exceed `TRAIL_MITER_LIMIT`, a two-point bevel across the corner instead.
 */
function TrailRibbon({ trailX, trailY, cameraX, height, radiusPx, image }: TrailRibbonProps) {
  const imageW = image.width();
  const imageH = image.height();

  const ribbon = useDerivedValue(() => {
    'worklet';
    const xs = trailX.value;
    const ys = trailY.value;
    const n = xs.length;
    if (n < 2) return { vertices: [] as SkPoint[], textures: [] as SkPoint[] };

    const sx = new Array<number>(n);
    const sy = new Array<number>(n);
    for (let i = 0; i < n; i += 1) {
      sx[i] = xs[i] - cameraX.value;
      sy[i] = ys[i] * height;
    }

    // Unit tangent, length, and cumulative arc length of each segment i → i+1.
    const segLen = new Array<number>(n - 1);
    const tanX = new Array<number>(n - 1);
    const tanY = new Array<number>(n - 1);
    const cumLen = new Array<number>(n);
    cumLen[0] = 0;
    for (let i = 0; i < n - 1; i += 1) {
      const dx = sx[i + 1] - sx[i];
      const dy = sy[i + 1] - sy[i];
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      segLen[i] = len;
      tanX[i] = dx / len;
      tanY[i] = dy / len;
      cumLen[i + 1] = cumLen[i] + len;
    }
    const totalLen = cumLen[n - 1];
    if (totalLen <= 0) return { vertices: [] as SkPoint[], textures: [] as SkPoint[] };

    const vertices: SkPoint[] = [];
    const textures: SkPoint[] = [];
    const pushPair = (ax: number, ay: number, bx: number, by: number, u: number) => {
      vertices.push({ x: ax, y: ay });
      textures.push({ x: u, y: 0 });
      vertices.push({ x: bx, y: by });
      textures.push({ x: u, y: imageH });
    };

    // Start cap: square across the first segment's own normal.
    const startNx = -tanY[0] * radiusPx;
    const startNy = tanX[0] * radiusPx;
    pushPair(sx[0] + startNx, sy[0] + startNy, sx[0] - startNx, sy[0] - startNy, 0);

    for (let i = 1; i < n - 1; i += 1) {
      const t1x = tanX[i - 1];
      const t1y = tanY[i - 1];
      const t2x = tanX[i];
      const t2y = tanY[i];
      // Perpendicular normal, rotated 90° from each tangent.
      const n1x = -t1y;
      const n1y = t1x;
      const n2x = -t2y;
      const n2y = t2x;
      const u = (cumLen[i] / totalLen) * imageW;

      let mx = n1x + n2x;
      let my = n1y + n2y;
      const mLen = Math.sqrt(mx * mx + my * my);
      if (mLen < 1e-6) {
        // Ship reversed direction almost exactly (~180°): no well-defined miter
        // bisector, so just bevel across both segments' own normals.
        pushPair(sx[i] + n1x * radiusPx, sy[i] + n1y * radiusPx, sx[i] - n1x * radiusPx, sy[i] - n1y * radiusPx, u);
        pushPair(sx[i] + n2x * radiusPx, sy[i] + n2y * radiusPx, sx[i] - n2x * radiusPx, sy[i] - n2y * radiusPx, u);
        continue;
      }
      mx /= mLen;
      my /= mLen;
      // How far the miter point sits from the corner, along the bisector, to
      // exactly meet both segments' offset edges.
      const cosHalfAngle = mx * n1x + my * n1y;
      const miterFactor = 1 / Math.max(cosHalfAngle, 1e-3);
      // That same extension measured along the legs themselves — clamp it to
      // half of whichever leg is shorter so a joint can never reach past the
      // *next* joint and tear the strip open there instead.
      const reachAlongLeg = radiusPx * Math.sqrt(Math.max(miterFactor * miterFactor - 1, 0));
      const room = Math.min(segLen[i - 1], segLen[i]) * 0.5;
      const scale = reachAlongLeg <= room ? 1 : room / reachAlongLeg;
      const miterLen = radiusPx * miterFactor * scale;
      // Sign of the turn: which side of the path is the inside of the corner.
      const cross = t1x * t2y - t1y * t2x;

      const miterPx = sx[i] + mx * miterLen;
      const miterPy = sy[i] + my * miterLen;
      const innerPx = sx[i] - mx * miterLen;
      const innerPy = sy[i] - my * miterLen;

      if (miterFactor <= TRAIL_MITER_LIMIT && scale === 1) {
        // True sharp corner: one vertex pair, exactly on both segments' edges.
        pushPair(miterPx, miterPy, innerPx, innerPy, u);
      } else if (cross < 0) {
        // Outside of the turn is the +normal side: bevel it across two
        // vertices, but keep the inside pinned to the single shared point so
        // the strip can't fold over itself there.
        pushPair(sx[i] + n1x * radiusPx, sy[i] + n1y * radiusPx, innerPx, innerPy, u);
        pushPair(sx[i] + n2x * radiusPx, sy[i] + n2y * radiusPx, innerPx, innerPy, u);
      } else {
        pushPair(miterPx, miterPy, sx[i] - n1x * radiusPx, sy[i] - n1y * radiusPx, u);
        pushPair(miterPx, miterPy, sx[i] - n2x * radiusPx, sy[i] - n2y * radiusPx, u);
      }
    }

    // End cap: square across the last segment's own normal, right at the ship.
    const last = n - 1;
    const endNx = -tanY[last - 1] * radiusPx;
    const endNy = tanX[last - 1] * radiusPx;
    pushPair(sx[last] + endNx, sy[last] + endNy, sx[last] - endNx, sy[last] - endNy, imageW);

    return { vertices, textures };
  });

  const ribbonVertices = useDerivedValue(() => ribbon.value.vertices);
  const ribbonTextures = useDerivedValue(() => ribbon.value.textures);

  return (
    <Vertices vertices={ribbonVertices} textures={ribbonTextures} mode="triangleStrip">
      <ImageShader image={image} fit="fill" rect={{ x: 0, y: 0, width: imageW, height: imageH }} />
    </Vertices>
  );
}

type ObstacleSpriteProps = {
  obstacle: Obstacle;
  cameraX: SharedValue<number>;
  elapsed: SharedValue<number>;
  height: number;
  fanImage: SkImage | null;
  spikeClusterImage: SkImage | null;
  spikeConeImage: SkImage | null;
};

/**
 * A single obstacle sprite, always flush against the wall it grows from —
 * see `depth` below for how "flush" is kept exact despite each sprite having
 * a different (non-square) source aspect ratio.
 *
 * Fans spin about their hub. Cones already point up in the source art, so a
 * ceiling mount just flips them vertically. The cluster's source points its
 * three spikes *sideways* (drawn for a side wall), so mounting it on the
 * floor/ceiling needs an actual 90° rotation rather than a flip.
 */
function ObstacleSprite({
  obstacle,
  cameraX,
  elapsed,
  height,
  fanImage,
  spikeClusterImage,
  spikeConeImage,
}: ObstacleSpriteProps) {
  const image =
    obstacle.kind === 'fan' ? fanImage : obstacle.spikeVariant === 'cluster' ? spikeClusterImage : spikeConeImage;
  const rotated = obstacle.kind === 'spike' && obstacle.spikeVariant === 'cluster';

  // `depth` is the away-from-wall extent `levels.ts` placed the obstacle
  // center `depth / 2` from the wall for, so it must be exactly the drawn
  // size on the screen-vertical axis — whichever source axis that is depends
  // on whether this variant gets rotated 90° (see the class doc above).
  // Drawing into a box sized to the sprite's own aspect ratio (instead of a
  // square with `fit="contain"`) avoids letterbox padding, so the visible
  // art — not just the invisible bounding box — actually reaches the wall.
  const depth = obstacle.radius * height * 2.3;
  const aspect = image ? image.width() / image.height() : 1;
  const drawnW = rotated ? depth : depth * aspect;
  const drawnH = rotated ? depth / aspect : depth;

  const transform = useDerivedValue(() => {
    const translate = [{ translateX: obstacle.x - cameraX.value }, { translateY: obstacle.y * height }];
    if (rotated) {
      // Cluster: rotate to point at the corridor instead of sideways.
      return [...translate, { rotate: obstacle.towardTop ? Math.PI / 2 : -Math.PI / 2 }];
    }
    if (obstacle.kind === 'fan') {
      return [...translate, { rotate: elapsed.value * obstacle.spin }];
    }
    // Cone: source already points up — flip vertically for a ceiling mount.
    return [...translate, { scaleY: obstacle.towardTop ? -1 : 1 }];
  });

  if (!image) return null;

  return (
    <Group transform={transform}>
      <SkiaImage image={image} x={-drawnW / 2} y={-drawnH / 2} width={drawnW} height={drawnH} fit="contain" />
    </Group>
  );
}

type CoinSpriteProps = {
  coin: Coin;
  /** This coin's position in `level.coins` — compared against the engine's
   *  coin cursor to know whether it's already resolved (collected or passed). */
  index: number;
  cameraX: SharedValue<number>;
  coinCursor: SharedValue<number>;
  height: number;
};

/**
 * One coin sitting on the course. Hidden once the engine's cursor has moved past
 * this coin's index, since resolution is strictly forward-moving just like the
 * obstacle cursor — and when that index was *collected* rather than missed,
 * `CollectedCoinFx` picks the coin up from this exact spot in the same frame.
 */
function CoinSprite({ coin, index, cameraX, coinCursor, height }: CoinSpriteProps) {
  const transform = useDerivedValue(() => [
    { translateX: coin.x - cameraX.value },
    { translateY: coin.y * height },
  ]);

  const opacity = useDerivedValue(() => (index < coinCursor.value ? 0 : 1));

  return (
    <Group transform={transform} opacity={opacity}>
      <CoinDisc radiusPx={COIN_RADIUS * height} />
    </Group>
  );
}

/**
 * The coin's own art, drawn around the origin — a placeholder gold gradient disc
 * (same language as the wallet's `CoinIcon`) until real Figma art replaces it.
 * Shared by the coins lying on the course and by the pickup flourish, so the coin
 * that flies to the HUD is visibly the same object that was just sitting there.
 */
function CoinDisc({ radiusPx }: { radiusPx: number }) {
  return (
    <Group>
      <Circle cx={0} cy={0} r={radiusPx}>
        <LinearGradient
          start={vec(-radiusPx, -radiusPx)}
          end={vec(radiusPx, radiusPx)}
          colors={['#FFE9A8', '#F2B93B', '#C4790E']}
        />
      </Circle>
      <Circle cx={0} cy={0} r={radiusPx} style="stroke" strokeWidth={radiusPx * 0.18} color="rgba(255,255,255,0.55)" />
    </Group>
  );
}

type CollectedCoinFxProps = {
  coinFxX: SharedValue<number>;
  coinFxY: SharedValue<number>;
  coinFxAt: SharedValue<number>;
  elapsed: SharedValue<number>;
  cameraX: SharedValue<number>;
  targetX: SharedValue<number>;
  targetY: SharedValue<number>;
  height: number;
  radiusPx: number;
};

/**
 * What a picked-up coin does after `CoinSprite` blinks out: it pops up, flips a
 * couple of times with a ring flash (`COIN_POP_MS`), then arcs into the HUD
 * counter, shrinking and spinning faster (`COIN_FLY_MS`).
 *
 * One instance covers every coin in the level rather than one per pickup: the
 * engine hands over only the *latest* pickup, and coins sit ~2.3s apart even on
 * the fastest course, so two flourishes can never be in the air at once.
 *
 * The clock is the engine's own `elapsed`, which only advances while the run is
 * RUNNING — so the flourish freezes on pause and resumes with the game for free.
 * Reading it also re-evaluates this every frame, which is what keeps the
 * world-anchored source point below tracking the camera.
 */
function CollectedCoinFx({
  coinFxX,
  coinFxY,
  coinFxAt,
  elapsed,
  cameraX,
  targetX,
  targetY,
  height,
  radiusPx,
}: CollectedCoinFxProps) {
  const fx = useDerivedValue(() => {
    'worklet';
    const ms = coinFxAt.value < 0 ? -1 : (elapsed.value - coinFxAt.value) * 1000;
    if (ms < 0 || ms > COIN_FX_MS) {
      return { x: 0, y: 0, scale: 1, flip: 1, opacity: 0, ringX: 0, ringY: 0, ringRadius: 0, ringOpacity: 0 };
    }

    // The source stays pinned to the world, so the flourish drifts backwards with
    // the scene it came out of instead of hanging in place on screen.
    const sourceX = coinFxX.value - cameraX.value;
    const sourceY = coinFxY.value * height;
    const flipAt = (angle: number) => COIN_FLIP_MIN + (1 - COIN_FLIP_MIN) * Math.abs(Math.cos(angle));

    if (ms < COIN_POP_MS) {
      const p = ms / COIN_POP_MS;
      // Ease out: the pop is fastest at the very start, like a real snatch.
      const ease = 1 - (1 - p) * (1 - p);
      const ring = Math.min(1, ms / COIN_RING_MS);
      return {
        x: sourceX,
        y: sourceY - radiusPx * COIN_POP_RISE * ease,
        scale: 1 + 0.5 * ease,
        flip: flipAt(p * Math.PI * 2),
        opacity: 1,
        // The flash stays put at the spot the coin was snatched from while the
        // coin itself rises out of it.
        ringX: sourceX,
        ringY: sourceY,
        ringRadius: radiusPx * (0.9 + 1.7 * ring),
        ringOpacity: 1 - ring,
      };
    }

    const q = (ms - COIN_POP_MS) / COIN_FLY_MS;
    // Ease in: hangs at the pickup point for a beat, then snaps into the counter.
    const e = q * q;
    const fromX = sourceX;
    const fromY = sourceY - radiusPx * COIN_POP_RISE;
    const toX = targetX.value;
    const toY = targetY.value;
    // Quadratic Bézier through a control point above the pickup: the coin arcs up
    // out of the corridor first instead of cutting a straight line to the HUD.
    const controlX = fromX + (toX - fromX) * 0.15;
    const controlY = fromY - height * 0.12;
    const inv = 1 - e;
    return {
      x: inv * inv * fromX + 2 * inv * e * controlX + e * e * toX,
      y: inv * inv * fromY + 2 * inv * e * controlY + e * e * toY,
      scale: 1.5 - e,
      flip: flipAt(Math.PI * 2 + q * Math.PI * 4),
      opacity: 1 - Math.max(0, q - 0.85) / 0.15,
      ringX: 0,
      ringY: 0,
      ringRadius: 0,
      ringOpacity: 0,
    };
  });

  const coinTransform = useDerivedValue(() => [
    { translateX: fx.value.x },
    { translateY: fx.value.y },
    { scale: fx.value.scale },
    // Squashing x last turns the uniform disc edge-on: the classic 2D coin spin.
    { scaleX: fx.value.flip },
  ]);
  const coinOpacity = useDerivedValue(() => fx.value.opacity);
  // The ring only translates — its growth is its own radius, not the coin's scale.
  const ringTransform = useDerivedValue(() => [{ translateX: fx.value.ringX }, { translateY: fx.value.ringY }]);
  const ringRadius = useDerivedValue(() => fx.value.ringRadius);
  const ringOpacity = useDerivedValue(() => fx.value.ringOpacity);

  return (
    <Group>
      <Group transform={ringTransform} opacity={ringOpacity}>
        <Circle
          cx={0}
          cy={0}
          r={ringRadius}
          style="stroke"
          strokeWidth={radiusPx * 0.22}
          color="rgba(255,233,168,0.9)"
        />
      </Group>
      <Group transform={coinTransform} opacity={coinOpacity}>
        <CoinDisc radiusPx={radiusPx} />
      </Group>
    </Group>
  );
}

type WallStoneTileProps = {
  index: number;
  cameraX: SharedValue<number>;
  height: number;
  image: SkImage;
};

/**
 * One repeating stone tile. `index` is this instance's fixed slot; each frame it
 * re-derives which world tile belongs in that slot from the camera position —
 * fixed component count, continuous tiling, same wrap idea as `cloudsPath`'s `cycle`.
 *
 * The source art isn't a seamless tile, so butting two copies edge-to-edge shows
 * a visible seam. Mirroring every other tile makes each boundary meet its own
 * reflection instead of an unrelated edge, so it always lines up — same trick as
 * mirrored/"ping-pong" texture repeat.
 */
function WallStoneTile({ index, cameraX, height, image }: WallStoneTileProps) {
  const transform = useDerivedValue(() => {
    const camera = cameraX.value;
    const baseIndex = Math.floor(camera / WALL_TILE_SIZE) - 1;
    const worldIndex = baseIndex + index;
    const left = worldIndex * WALL_TILE_SIZE - camera;
    const flipped = ((worldIndex % 2) + 2) % 2 === 1;
    if (flipped) {
      return [{ translateX: left + WALL_TILE_SIZE }, { scaleX: -1 }];
    }
    return [{ translateX: left }];
  });

  return (
    <Group transform={transform}>
      <SkiaImage image={image} x={0} y={0} width={WALL_TILE_SIZE} height={height} fit="cover" />
    </Group>
  );
}
