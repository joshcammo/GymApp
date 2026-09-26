/** One set as shown across the app, always weight first to match entry:
 *  '60 KG × 8', '60 KG' (no reps logged) or '12 reps' (bodyweight). */
export function formatSet(
  s: { reps?: number | null; weight?: number | null },
  unit: string,
): string {
  if (s.weight != null) {
    return s.reps ? `${s.weight} ${unit} × ${s.reps}` : `${s.weight} ${unit}`;
  }
  return `${s.reps ?? '?'} reps`;
}
