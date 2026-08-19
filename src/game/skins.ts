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
  /** Small square thumbnail shown in the customization shop; falls back to `image` if unset. */
  previewImage?: ImageSourcePropType;
};

export const PLANE_SKINS: readonly PlaneSkin[] = [
  { id: 'classic', name: 'Classic', price: 0, image: require('@/assets/game/plane/classic.webp') },
  { id: 'azure', name: 'Azure', price: 500, image: require('@/assets/game/plane/azure.webp') },
  { id: 'crimson', name: 'Crimson', price: 1000, image: require('@/assets/game/plane/crimson.webp') },
  { id: 'emerald', name: 'Emerald', price: 1500, image: require('@/assets/game/plane/emerald.webp') },
  { id: 'violet', name: 'Violet', price: 2000, image: require('@/assets/game/plane/violet.webp') },
  { id: 'sunset', name: 'Sunset', price: 2500, image: require('@/assets/game/plane/sunset.webp') },
  { id: 'arctic', name: 'Arctic', price: 3000, image: require('@/assets/game/plane/arctic.webp') },
  { id: 'cosmic', name: 'Cosmic', price: 4000, image: require('@/assets/game/plane/cosmic.webp') },
  { id: 'bubblegum', name: 'Bubblegum', price: 4500, image: require('@/assets/game/plane/bubblegum.webp') },
];

export const TRAIL_SKINS: readonly TrailSkin[] = [
  { id: 'smoke', name: 'Smoke', price: 0, image: require('@/assets/game/trail/smoke.webp') },
  { id: 'aqua', name: 'Aqua', price: 500, image: require('@/assets/game/trail/aqua.webp') },
  { id: 'fire', name: 'Fire', price: 1000, image: require('@/assets/game/trail/fire.webp') },
  { id: 'toxic', name: 'Toxic', price: 1500, image: require('@/assets/game/trail/toxic.webp') },
  { id: 'candy', name: 'Candy', price: 2000, image: require('@/assets/game/trail/candy.webp') },
  { id: 'ice', name: 'Ice', price: 2500, image: require('@/assets/game/trail/ice.webp') },
  { id: 'ember', name: 'Ember', price: 3000, image: require('@/assets/game/trail/ember.webp') },
  { id: 'royal', name: 'Royal', price: 4000, image: require('@/assets/game/trail/royal.webp') },
];

export const SKY_SKINS: readonly SkySkin[] = [
  {
    id: 'day',
    name: 'Clear Day',
    price: 0,
    image: require('@/assets/game/sky/day.webp'),
    previewImage: require('@/assets/game/sky/preview/day.webp'),
  },
  {
    id: 'sunset',
    name: 'Sunset',
    price: 500,
    image: require('@/assets/game/sky/sunset.webp'),
    previewImage: require('@/assets/game/sky/preview/sunset.webp'),
  },
  {
    id: 'night',
    name: 'Night',
    price: 1000,
    image: require('@/assets/game/sky/night.webp'),
    previewImage: require('@/assets/game/sky/preview/night.webp'),
  },
  {
    id: 'dawn',
    name: 'Dawn',
    price: 1500,
    image: require('@/assets/game/sky/dawn.webp'),
    previewImage: require('@/assets/game/sky/preview/dawn.webp'),
  },
  {
    id: 'storm',
    name: 'Storm',
    price: 2000,
    image: require('@/assets/game/sky/storm.webp'),
    previewImage: require('@/assets/game/sky/preview/storm.webp'),
  },
  {
    id: 'aurora',
    name: 'Aurora',
    price: 2500,
    image: require('@/assets/game/sky/aurora.webp'),
    previewImage: require('@/assets/game/sky/preview/aurora.webp'),
  },
  {
    id: 'nebula',
    name: 'Nebula',
    price: 3000,
    image: require('@/assets/game/sky/nebula.webp'),
    previewImage: require('@/assets/game/sky/preview/nebula.webp'),
  },
  {
    id: 'cosmic',
    name: 'Cosmic Crest',
    price: 4000,
    image: require('@/assets/game/sky/cosmic.webp'),
    previewImage: require('@/assets/game/sky/preview/cosmic.webp'),
  },
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
