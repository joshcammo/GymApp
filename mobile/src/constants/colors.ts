/**
 * App colour palette — dark gym theme with orange accent
 */
export const COLORS = {
  // Backgrounds
  bg:          '#111111',
  bgAlt:       '#181818',
  card:        '#1E1E1E',
  cardBorder:  '#2A2A2A',

  // Primary accent — energetic orange
  primary:     '#FF6B2B',
  primaryDark: '#CC5520',
  primaryLight:'#FF8C55',
  primaryBg:   'rgba(255, 107, 43, 0.14)',

  // Text
  text:        '#FFFFFF',
  textSub:     '#AAAAAA',
  textMuted:   '#555555',

  // UI
  border:      '#2C2C2C',
  divider:     '#242424',

  // Semantic
  danger:      '#FF4545',
  dangerBg:    'rgba(255, 69, 69, 0.12)',
  success:     '#44D188',
  successBg:   'rgba(68, 209, 136, 0.12)',
} as const;
