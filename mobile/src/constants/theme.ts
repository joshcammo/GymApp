import { ColorTokens } from '../theme/colorways';

/**
 * Display typeface: Space Grotesk, loaded in App.tsx.
 * Used for headings, numbers and buttons; body copy stays on the system font.
 *
 * NOTE: never combine these with `fontWeight` in a style: on Android that
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

/** Primary CTA gradient for the active colorway: light → deep. */
export function gradientPrimary(colors: ColorTokens): readonly [string, string] {
  return [colors.gradientStart, colors.gradientEnd];
}

/** Soft glow (in the colorway's primary hue) used behind primary buttons and the logo. */
export function glow(colors: ColorTokens) {
  return {
    shadowColor:   colors.primary,
    shadowOpacity: 0.35,
    shadowRadius:  16,
    shadowOffset:  { width: 0, height: 6 },
    elevation:     8,
  } as const;
}
