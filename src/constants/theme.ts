/**
 * Design tokens derived from the Space Waves: Cosmic Crest Figma file.
 *
 * The art direction is fixed (a bright sky world with brushed-metal UI chrome),
 * so there is deliberately no light/dark switching here.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Palette = {
  /** Sky gradient, top to bottom. */
  skyTop: '#2E86CE',
  skyMid: '#63B6EE',
  skyBottom: '#B9E4FB',

  /** Brushed metal panel chrome. */
  metalLight: '#D6DAE0',
  metalMid: '#A7ADB6',
  metalDark: '#767D87',
  metalEdge: '#4E545C',
  screw: '#6E757F',

  /** Dark inset used for buttons and value plates. */
  inkFace: '#16181C',
  inkFaceLift: '#2A2E35',
  inkEdge: '#3C424B',

  /** Green rails that frame the primary buttons. */
  limeLight: '#A9E05A',
  lime: '#7FC63C',
  limeDark: '#4F8E1E',

  /** Coins and highlights. */
  gold: '#FFC93C',
  goldDark: '#D9971A',

  /** Feedback colors. */
  danger: '#E2453B',
  dangerDark: '#A82B24',
  success: '#2E9E4F',

  textPrimary: '#FFFFFF',
  textOnMetal: '#1B1E23',
  textMuted: '#B6BCC5',

  scrim: 'rgba(6, 14, 26, 0.68)',
} as const;

export const Fonts = Platform.select({
  ios: { display: 'system-ui', mono: 'ui-monospace' },
  default: { display: 'normal', mono: 'monospace' },
  web: { display: 'var(--font-display)', mono: 'var(--font-mono)' },
})!;

/** The Figma design's display face, used for all headings/buttons/titles. */
export const DisplayFont = 'PoetsenOne_400Regular';

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
} as const;

export const Radius = {
  small: 6,
  medium: 10,
  large: 16,
  pill: 999,
} as const;

/** Shared text styles. Titles in this design are always uppercase and tracked out. */
export const Type = {
  title: {
    fontFamily: DisplayFont,
    fontSize: 28,
    letterSpacing: 1.2,
    color: Palette.textPrimary,
  },
  heading: {
    fontFamily: DisplayFont,
    fontSize: 20,
    letterSpacing: 0.8,
    color: Palette.textPrimary,
  },
  button: {
    fontFamily: DisplayFont,
    fontSize: 26,
    letterSpacing: 0.6,
    color: Palette.textPrimary,
  },
  body: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.textPrimary,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.textMuted,
  },
} as const;

/** Gradient stop tuples, shared so panels and buttons stay consistent. */
export const Gradients = {
  sky: [Palette.skyTop, Palette.skyMid, Palette.skyBottom],
  metalInset: [Palette.metalDark, Palette.metalMid],
  ink: [Palette.inkFaceLift, Palette.inkFace],
  lime: [Palette.limeLight, Palette.lime, Palette.limeDark],
  gold: [Palette.gold, Palette.goldDark],
} as const;

export const MaxContentWidth = 520;
