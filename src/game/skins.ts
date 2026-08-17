/**
 * Customization catalog for the shop: plane, trail and sky.
 *
 * Plane and sky skins are backed by real Figma-exported artwork; trail skins stay
 * color-only since the trail is a procedural gradient stroke.
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
  /** Head and tail colors of the trail gradient. */
  colors: readonly [string, string];
};

export type SkySkin = BaseSkin & {
  image: ImageSourcePropType;
  /** Tint applied to the rock walls so they read against the sky. */
  wall: string;
  wallShade: string;
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
  { id: 'smoke', name: 'Smoke', price: 0, colors: ['#FFFFFF', 'rgba(255,255,255,0)'] },
  { id: 'aqua', name: 'Aqua', price: 500, colors: ['#7FE9FF', 'rgba(127,233,255,0)'] },
  { id: 'fire', name: 'Fire', price: 1000, colors: ['#FFB03A', 'rgba(226,69,59,0)'] },
  { id: 'toxic', name: 'Toxic', price: 1500, colors: ['#B6F13A', 'rgba(93,182,26,0)'] },
  { id: 'candy', name: 'Candy', price: 2000, colors: ['#FF8AD1', 'rgba(160,92,214,0)'] },
  { id: 'ice', name: 'Ice', price: 2500, colors: ['#CFEBFF', 'rgba(94,166,224,0)'] },
  { id: 'ember', name: 'Ember', price: 3000, colors: ['#FF5F3A', 'rgba(90,10,40,0)'] },
  { id: 'royal', name: 'Royal', price: 4000, colors: ['#FFD75E', 'rgba(138,92,214,0)'] },
];

export const SKY_SKINS: readonly SkySkin[] = [
  { id: 'day', name: 'Clear Day', price: 0, image: require('@/assets/game/sky/day.png'), wall: '#7C8896', wallShade: '#4A535E' },
  { id: 'sunset', name: 'Sunset', price: 500, image: require('@/assets/game/sky/sunset.png'), wall: '#6B5A70', wallShade: '#3D3244' },
  { id: 'night', name: 'Night', price: 1000, image: require('@/assets/game/sky/night.png'), wall: '#3A4258', wallShade: '#1E2333' },
  { id: 'dawn', name: 'Dawn', price: 1500, image: require('@/assets/game/sky/dawn.png'), wall: '#7A6A80', wallShade: '#463C50' },
  { id: 'storm', name: 'Storm', price: 2000, image: require('@/assets/game/sky/storm.png'), wall: '#59626E', wallShade: '#333A44' },
  { id: 'aurora', name: 'Aurora', price: 2500, image: require('@/assets/game/sky/aurora.png'), wall: '#33505A', wallShade: '#1A2A32' },
  { id: 'nebula', name: 'Nebula', price: 3000, image: require('@/assets/game/sky/nebula.png'), wall: '#4A3560', wallShade: '#281A38' },
  { id: 'cosmic', name: 'Cosmic Crest', price: 4000, image: require('@/assets/game/sky/cosmic.png'), wall: '#2E3A55', wallShade: '#161C2C' },
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
