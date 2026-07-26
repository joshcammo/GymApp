import { Feather } from '@expo/vector-icons';
import { ColorTokens } from '../theme/colorways';
import { MuscleGroupBalance } from '../types';

export type BalanceBucket = 'NO_DATA' | 'NEW' | 'WELL_UNDER' | 'UNDER' | 'ON_TRACK' | 'OVER' | 'WELL_OVER';

export interface BalanceRead {
  bucket:  BalanceBucket;
  /** null when there's no baseline to compare against (NO_DATA / NEW) */
  pctDelta: number | null;
}

/** Ratio thresholds are multiplicative around 1.0 (0.8 / 1.25 are reciprocals),
 *  so "under" and "over" require the same proportional swing either way.
 *  Measured in hard sets, not kg: a bodyweight pull-up counts the same
 *  as a loaded row, since weight is optional for bodyweight exercises
 *  and would otherwise be invisible to a kg-based comparison.
 *
 *  Shared by the Progress screen's heatmap and the Home dashboard's
 *  "today's focus" recommendation, so the two never disagree about what
 *  counts as under-trained. */
export function classifyBalance(row: MuscleGroupBalance): BalanceRead {
  if (row.baseline_weekly_avg_sets <= 0) {
    return row.recent_sets > 0 ? { bucket: 'NEW', pctDelta: null } : { bucket: 'NO_DATA', pctDelta: null };
  }
  const ratio = row.recent_sets / row.baseline_weekly_avg_sets;
  const pctDelta = Math.round((ratio - 1) * 100);
  if (ratio < 0.5) return { bucket: 'WELL_UNDER', pctDelta };
  if (ratio < 0.8) return { bucket: 'UNDER', pctDelta };
  if (ratio <= 1.25) return { bucket: 'ON_TRACK', pctDelta };
  if (ratio <= 2.0) return { bucket: 'OVER', pctDelta };
  return { bucket: 'WELL_OVER', pctDelta };
}

export type BucketStyle = { icon: keyof typeof Feather.glyphMap; label: string; color: string; bg: string; dashed?: boolean };

/** A function of the active colorway, not a static export: `cold` and
 *  `primary` (the diverging over/under-trained pair) vary per colorway, and
 *  for colorways whose own primary is blue (Navy Electric, Cobalt Cyan) the
 *  colorway data picks a `cold` hue well clear of `primary` specifically so
 *  this pair never collides. See theme/colorways.ts.
 *
 *  Shared by the Progress screen's heatmap tiles and the Home dashboard's
 *  body heatmap, so both use the same color for a given bucket. */
export function createBucketStyle(colors: ColorTokens): Record<BalanceBucket, BucketStyle> {
  return {
    NO_DATA:    { icon: 'circle',        label: 'No data',    color: colors.textMuted, bg: colors.card, dashed: true },
    NEW:        { icon: 'zap',           label: 'New',        color: colors.textMuted, bg: colors.card, dashed: true },
    WELL_UNDER: { icon: 'trending-down', label: 'Well under', color: colors.cold,      bg: colors.coldBg },
    UNDER:      { icon: 'trending-down', label: 'Under',      color: colors.cold,      bg: colors.coldBgMild },
    ON_TRACK:   { icon: 'check',         label: 'On track',   color: colors.textSub,  bg: colors.card },
    OVER:       { icon: 'trending-up',   label: 'Over',       color: colors.primary,  bg: colors.primaryBgMild },
    WELL_OVER:  { icon: 'trending-up',   label: 'Well over',  color: colors.primary,  bg: colors.primaryBg },
  };
}
