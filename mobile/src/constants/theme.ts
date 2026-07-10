import { COLORS } from './colors';

/**
 * Display typeface — Space Grotesk, loaded in App.tsx.
 * Used for headings, numbers and buttons; body copy stays on the system font.
 *
 * NOTE: never combine these with `fontWeight` in a style — on Android that
 * discards the custom family. The weight is baked into each family name.
 */
export const FONT = {
  medium:   'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold:     'SpaceGrotesk_700Bold',
} as const;

export const RADIUS = {
  sm:   10,
  md:   14,
  lg:   18,
  xl:   24,
  pill: 999,
} as const;

/** Primary CTA gradient — hot ember, light → deep */
export const GRADIENT_PRIMARY = ['#FF8A3D', '#FF5A1F'] as const;

/** Soft orange glow used behind primary buttons and the logo */
export const GLOW = {
  shadowColor:   COLORS.primary,
  shadowOpacity: 0.35,
  shadowRadius:  16,
  shadowOffset:  { width: 0, height: 6 },
  elevation:     8,
} as const;
