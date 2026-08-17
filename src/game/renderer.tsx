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
  LinearGradient,
  Path,
  Skia,
  useImage,
  vec,
  type DataSourceParam,
  type SkImage,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { SHIP_RADIUS, SHIP_SCREEN_X, TRAIL_SAMPLES, type WaveEngine } from '@/game/engine';
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

export function GameRenderer({ engine, level, width, height, plane, trail, sky }: Props) {
  const { shipX, shipY, holding, elapsed, trailX, trailY, trailHead } = engine;

  const shipRadiusPx = SHIP_RADIUS * height;
  const shipScreenX = width * SHIP_SCREEN_X;

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

  // --- Trail ----------------------------------------------------------------
  const trailPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const camera = cameraX.value;
    const head = trailHead.value;
    const xs = trailX.value;
    const ys = trailY.value;

    let started = false;
    for (let step = 1; step <= TRAIL_SAMPLES; step += 1) {
      const index = (head + step) % TRAIL_SAMPLES;
      const px = xs[index] - camera;
      const py = ys[index] * height;
      if (px < -60) continue;
      if (!started) {
        path.moveTo(px, py);
        started = true;
      } else {
        path.lineTo(px, py);
      }
    }

    return path;
  });

  const trailStart = useDerivedValue(() => vec(Math.max(0, shipScreenX - 220), 0));
  const trailEnd = useDerivedValue(() => vec(shipScreenX, 0));

  // --- Ship -----------------------------------------------------------------
  const shipImage = useImage(plane.image as DataSourceParam);
  const shipWidth = shipRadiusPx * 3.4;
  const shipAspect = shipImage ? shipImage.width() / shipImage.height() : 1.37;
  const shipHeight = shipWidth / shipAspect;

  const shipTransform = useDerivedValue(() => {
    // Tilt to match the actual flight vector so the nose points where it travels.
    const rise = (holding.value === 1 ? -1 : 1) * level.climbRate * height;
    const angle = Math.atan2(rise, level.speed);
    return [{ translateX: shipScreenX }, { translateY: shipY.value * height }, { rotate: angle }];
  });

  // --- Finish gate ----------------------------------------------------------
  const finishPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const screenX = level.length - cameraX.value;
    if (screenX > width + 60 || screenX < -60) return path;

    const band = 14;
    const rows = 16;
    const rowHeight = height / rows;
    for (let row = 0; row < rows; row += 1) {
      if (row % 2 === 0) continue;
      path.addRect(Skia.XYWHRect(screenX - band, row * rowHeight, band, rowHeight));
      path.addRect(Skia.XYWHRect(screenX, (row - 1) * rowHeight, band, rowHeight));
    }
    return path;
  });

  const skyImage = useImage(sky.image as DataSourceParam);

  return (
    <Canvas style={{ width, height }}>
      {/* Sky: a static backdrop behind the scrolling corridor, not tied to the camera. */}
      {skyImage && <SkiaImage image={skyImage} x={0} y={0} width={width} height={height} fit="cover" />}

      <Path path={cloudsPath} color="rgba(255,255,255,0.55)" />

      {/* Finish gate sits behind the walls so it reads as part of the course. */}
      <Path path={finishPath} color="rgba(255,255,255,0.9)" />

      {/* Corridor */}
      <Path path={wallsPath}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[sky.wall, sky.wallShade]} />
      </Path>
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

      {/* Trail, drawn under the ship */}
      <Path path={trailPath} style="stroke" strokeWidth={shipRadiusPx * 0.7} strokeCap="round" strokeJoin="round">
        <LinearGradient start={trailStart} end={trailEnd} colors={[trail.colors[1], trail.colors[0]]} />
      </Path>

      <Group transform={shipTransform}>
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
 * A single obstacle sprite. Fans spin about their hub; spikes mirror vertically
 * depending on which wall they grow from (the source art points up, floor-mounted).
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
  const size = obstacle.radius * height * 2.3;

  const transform = useDerivedValue(() => {
    const rotate = obstacle.kind === 'fan' ? elapsed.value * obstacle.spin : 0;
    const scaleY = obstacle.kind === 'spike' && obstacle.towardTop ? -1 : 1;
    return [
      { translateX: obstacle.x - cameraX.value },
      { translateY: obstacle.y * height },
      { rotate },
      { scaleY },
    ];
  });

  if (!image) return null;

  return (
    <Group transform={transform}>
      <SkiaImage image={image} x={-size / 2} y={-size / 2} width={size} height={size} fit="contain" />
    </Group>
  );
}
