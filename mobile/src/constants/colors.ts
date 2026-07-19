/**
 * App colour palette — deep charcoal gym theme with ember-orange accent.
 *
 * Layering model (darkest → lightest):
 *   bg → bgAlt → card → cardRaised
 * Borders are translucent white so they read consistently on every layer.
 */
export const COLORS = {
  // Backgrounds
  bg:          '#0B0B0E',
  bgAlt:       '#111116',
  card:        '#17171D',
  cardRaised:  '#1D1D25',
  cardBorder:  'rgba(255, 255, 255, 0.07)',

  // Primary accent — ember orange
  primary:     '#FF6B2B',
  primaryDark: '#E5541A',
  primaryLight:'#FF8C55',
  primaryBg:   'rgba(255, 107, 43, 0.12)',

  // Text
  text:        '#F7F7F9',
  textSub:     '#A8A8B3',
  textMuted:   '#62626E',

  // UI
  border:      'rgba(255, 255, 255, 0.08)',
  divider:     'rgba(255, 255, 255, 0.05)',

  // Semantic
  danger:      '#FF5C5C',
  dangerBg:    'rgba(255, 92, 92, 0.12)',
  success:     '#3EDC97',
  successBg:   'rgba(62, 220, 151, 0.12)',

  // A lighter wash of the ember accent, for a "mild" intensity tier
  // alongside primaryBg's "strong" one (used by the muscle-group heatmap).
  primaryBgMild: 'rgba(255, 107, 43, 0.06)',

  // Diverging pair for the muscle-group heatmap — cool blue
  // (under-trained) vs. the existing ember accent (over-trained),
  // one of the more CVD-robust hue pairings. Contrast vs. both bg
  // and card clears 5:1 in each case.
  cold:         '#4C8DFF',
  coldBg:       'rgba(76, 141, 255, 0.12)',
  coldBgMild:   'rgba(76, 141, 255, 0.06)',
} as const;
