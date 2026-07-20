import { WeightUnit } from '../types';

/** Same conversion factor as the server's to_kg() (migration 006). */
const KG_PER_LB = 0.45359237;

export function toKg(weight: number, unit: WeightUnit): number {
  return unit === 'LBS' ? weight * KG_PER_LB : weight;
}

export function fromKg(weightKg: number, unit: WeightUnit): number {
  return unit === 'LBS' ? weightKg / KG_PER_LB : weightKg;
}

/** One suggested warm-up set leading into the working weight. */
export interface WarmupSet {
  percent: number; // fraction of the working weight, e.g. 0.4
  reps:    number;
  weight:  number; // rounded, in the caller's target unit
}

/** Standard barbell ramp: light and high-rep up to close to the working
 *  weight, in three steps — same shape as StrongLifts/5-3-1 style warm-ups. */
const RAMP: { percent: number; reps: number }[] = [
  { percent: 0.4, reps: 8 },
  { percent: 0.6, reps: 5 },
  { percent: 0.8, reps: 3 },
];

/** Smallest practical plate jump to round suggestions to (a 1.25kg / 2.5lb
 *  plate each side of a barbell) — exact percentages aren't loadable. */
const ROUNDING: Record<WeightUnit, number> = { KG: 2.5, LBS: 5 };

/** Below this there's no bar-empty-ish weight to meaningfully ramp into. */
const MIN_WORKING_KG = 20;

/**
 * Suggested warm-up ramp into `workingWeight` (in `workingUnit`), converted
 * and rounded to plate increments in `targetUnit`. Returns [] when there's
 * nothing sensible to suggest, e.g. a working weight too light to ramp into.
 */
export function calculateWarmupSets(
  workingWeight: number,
  workingUnit: WeightUnit,
  targetUnit: WeightUnit,
): WarmupSet[] {
  const workingKg = toKg(workingWeight, workingUnit);
  if (workingKg < MIN_WORKING_KG) return [];

  const targetWorking = fromKg(workingKg, targetUnit);
  const increment = ROUNDING[targetUnit];

  const sets: WarmupSet[] = [];
  for (const { percent, reps } of RAMP) {
    const rounded = Math.round((targetWorking * percent) / increment) * increment;
    // Drop anything that rounds down to nothing, or up to/past the working weight itself.
    if (rounded <= 0 || rounded >= targetWorking) continue;
    sets.push({ percent, reps, weight: rounded });
  }
  return sets;
}
