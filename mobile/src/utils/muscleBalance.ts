import { MuscleGroupBalance } from '../types';

export type BalanceBucket = 'NO_DATA' | 'NEW' | 'WELL_UNDER' | 'UNDER' | 'ON_TRACK' | 'OVER' | 'WELL_OVER';

export interface BalanceRead {
  bucket:  BalanceBucket;
  /** null when there's no baseline to compare against (NO_DATA / NEW) */
  pctDelta: number | null;
}

/** Ratio thresholds are multiplicative around 1.0 (0.8 / 1.25 are reciprocals),
 *  so "under" and "over" require the same proportional swing either way.
 *  Measured in hard sets, not kg — a bodyweight pull-up counts the same
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
