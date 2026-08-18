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
  Group,
  Image as SkiaImage,
  ImageShader,
  Path,
  Skia,
  useImage,
  Vertices,
  type DataSourceParam,
  type SkImage,
  type SkPoint,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { SHIP_RADIUS, SHIP_SCREEN_X, type WaveEngine } from '@/game/engine';
import { SEGMENT_WIDTH, type Level, type Obstacle } from '@/game/levels';
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
};

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

export function GameRenderer({ engine, level, width, height, plane, trail, sky, outroT }: Props) {
  const { shipX, shipY, shipVY, trailX, trailY, elapsed } = engine;

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

  const stoneImage = useImage(require('@/assets/game/walls/stone.png'));

  // --- Obstacles ------------------------------------------------------------
  const fanImage = useImage(require('@/assets/game/obstacles/fan.png'));
  const spikeClusterImage = useImage(require('@/assets/game/obstacles/spike-cluster.png'));
  const spikeConeImage = useImage(require('@/assets/game/obstacles/spike-cone.png'));

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

/**
 * The ship's actual path, retraced as a ribbon mesh and textured with the
 * trail skin's own art stretched along it — the *entire* source image maps
 * once onto whatever length of history is currently on screen (tail end at
 * the oldest point, bright/pointed end at the ship), rather than tiling it
 * repeatedly, so the art's own built-in fade reads correctly no matter how
 * the path bends.
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
    const cumLen = new Array<number>(n);
    cumLen[0] = 0;
    for (let i = 0; i < n; i += 1) {
      sx[i] = xs[i] - cameraX.value;
      sy[i] = ys[i] * height;
      if (i > 0) {
        const dx = sx[i] - sx[i - 1];
        const dy = sy[i] - sy[i - 1];
        cumLen[i] = cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy);
      }
    }
    const totalLen = cumLen[n - 1];
    if (totalLen <= 0) return { vertices: [] as SkPoint[], textures: [] as SkPoint[] };

    const vertices: SkPoint[] = new Array(n * 2);
    const textures: SkPoint[] = new Array(n * 2);

    for (let i = 0; i < n; i += 1) {
      const prev = i > 0 ? i - 1 : i;
      const next = i < n - 1 ? i + 1 : i;
      let tx = sx[next] - sx[prev];
      let ty = sy[next] - sy[prev];
      const len = Math.sqrt(tx * tx + ty * ty) || 1;
      tx /= len;
      ty /= len;
      // Perpendicular normal, rotated 90° from the tangent.
      const nx = -ty * radiusPx;
      const ny = tx * radiusPx;

      const u = (cumLen[i] / totalLen) * imageW;
      vertices[i * 2] = { x: sx[i] + nx, y: sy[i] + ny };
      vertices[i * 2 + 1] = { x: sx[i] - nx, y: sy[i] - ny };
      textures[i * 2] = { x: u, y: 0 };
      textures[i * 2 + 1] = { x: u, y: imageH };
    }

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
