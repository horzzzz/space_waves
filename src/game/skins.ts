/**
 * Customization catalog for the shop: plane, trail and sky.
 *
 * All three are backed by real Figma-exported artwork.
 */

import type { ImageSourcePropType } from 'react-native';

export type SkinKind = 'plane' | 'trail' | 'sky';

type BaseSkin = {
  id: string;
  name: string;
  /** Price in coins. Zero means owned from the start. */
  price: number;
};

export type PlaneSkin = BaseSkin & {
  image: ImageSourcePropType;
};

export type TrailSkin = BaseSkin & {
  image: ImageSourcePropType;
};

export type SkySkin = BaseSkin & {
  image: ImageSourcePropType;
};

export const PLANE_SKINS: readonly PlaneSkin[] = [
  { id: 'classic', name: 'Classic', price: 0, image: require('@/assets/game/plane/classic.png') },
  { id: 'azure', name: 'Azure', price: 500, image: require('@/assets/game/plane/azure.png') },
  { id: 'crimson', name: 'Crimson', price: 1000, image: require('@/assets/game/plane/crimson.png') },
  { id: 'emerald', name: 'Emerald', price: 1500, image: require('@/assets/game/plane/emerald.png') },
  { id: 'violet', name: 'Violet', price: 2000, image: require('@/assets/game/plane/violet.png') },
  { id: 'sunset', name: 'Sunset', price: 2500, image: require('@/assets/game/plane/sunset.png') },
  { id: 'arctic', name: 'Arctic', price: 3000, image: require('@/assets/game/plane/arctic.png') },
  { id: 'cosmic', name: 'Cosmic', price: 4000, image: require('@/assets/game/plane/cosmic.png') },
  { id: 'bubblegum', name: 'Bubblegum', price: 4500, image: require('@/assets/game/plane/bubblegum.png') },
];

export const TRAIL_SKINS: readonly TrailSkin[] = [
  { id: 'smoke', name: 'Smoke', price: 0, image: require('@/assets/game/trail/smoke.png') },
  { id: 'aqua', name: 'Aqua', price: 500, image: require('@/assets/game/trail/aqua.png') },
  { id: 'fire', name: 'Fire', price: 1000, image: require('@/assets/game/trail/fire.png') },
  { id: 'toxic', name: 'Toxic', price: 1500, image: require('@/assets/game/trail/toxic.png') },
  { id: 'candy', name: 'Candy', price: 2000, image: require('@/assets/game/trail/candy.png') },
  { id: 'ice', name: 'Ice', price: 2500, image: require('@/assets/game/trail/ice.png') },
  { id: 'ember', name: 'Ember', price: 3000, image: require('@/assets/game/trail/ember.png') },
  { id: 'royal', name: 'Royal', price: 4000, image: require('@/assets/game/trail/royal.png') },
];

export const SKY_SKINS: readonly SkySkin[] = [
  { id: 'day', name: 'Clear Day', price: 0, image: require('@/assets/game/sky/day.png') },
  { id: 'sunset', name: 'Sunset', price: 500, image: require('@/assets/game/sky/sunset.png') },
  { id: 'night', name: 'Night', price: 1000, image: require('@/assets/game/sky/night.png') },
  { id: 'dawn', name: 'Dawn', price: 1500, image: require('@/assets/game/sky/dawn.png') },
  { id: 'storm', name: 'Storm', price: 2000, image: require('@/assets/game/sky/storm.png') },
  { id: 'aurora', name: 'Aurora', price: 2500, image: require('@/assets/game/sky/aurora.png') },
  { id: 'nebula', name: 'Nebula', price: 3000, image: require('@/assets/game/sky/nebula.png') },
  { id: 'cosmic', name: 'Cosmic Crest', price: 4000, image: require('@/assets/game/sky/cosmic.png') },
];

export const DEFAULT_SKINS = {
  plane: PLANE_SKINS[0].id,
  trail: TRAIL_SKINS[0].id,
  sky: SKY_SKINS[0].id,
} as const;

export function getPlaneSkin(id: string): PlaneSkin {
  return PLANE_SKINS.find((skin) => skin.id === id) ?? PLANE_SKINS[0];
}

export function getTrailSkin(id: string): TrailSkin {
  return TRAIL_SKINS.find((skin) => skin.id === id) ?? TRAIL_SKINS[0];
}

export function getSkySkin(id: string): SkySkin {
  return SKY_SKINS.find((skin) => skin.id === id) ?? SKY_SKINS[0];
}

export const SKIN_CATALOG = {
  plane: PLANE_SKINS,
  trail: TRAIL_SKINS,
  sky: SKY_SKINS,
} as const;
