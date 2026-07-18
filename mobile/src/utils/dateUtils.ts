/** Returns the ISO week number (1–53) for a given date */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

/**
 * Returns the Monday of the current ISO week, offset by `weekOffset` weeks.
 * weekOffset = 0  → this week
 * weekOffset = -1 → last week
 */
export function getWeekStart(weekOffset = 0): Date {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun … 6=Sat
  const daysToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMon + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Returns an array of 7 Date objects for Mon–Sun of the given week */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

/** Subtract N calendar months, clamping the day-of-month to the target
 *  month's last day instead of letting a native `setMonth` call silently
 *  roll into the month after — e.g. May 31 minus 3 months would otherwise
 *  normalize to Mar 2/3 (Feb has no 31st), same for Feb 29 minus 12 months
 *  landing on a non-leap year. */
function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - months);
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDayOfTargetMonth));
  return result;
}

/** Lower date bound ('YYYY-MM-DD') for a Progress screen TimeRange, or null for 'ALL'. */
export function sinceDateForRange(range: 'ALL' | '4W' | '3M' | '1Y'): string | null {
  if (range === 'ALL') return null;
  if (range === '4W') {
    const since = new Date();
    since.setDate(since.getDate() - 28);
    return toDateStr(since);
  }
  return toDateStr(subtractMonths(new Date(), range === '3M' ? 3 : 12));
}

/** 'YYYY-MM-DD' */
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a 'YYYY-MM-DD' string at midday, avoiding timezone day-rollover */
export function parseDateStr(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

/** 'May 19 – May 25, 2024' */
export function fmtWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  const s = weekStart.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

const SHORT_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const FULL_DAYS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function getDayShort(date: Date): string { return SHORT_DAYS[date.getDay()]; }
export function getDayFull(date: Date):  string { return FULL_DAYS[date.getDay()]; }

export function isToday(date: Date): boolean {
  const t = new Date();
  return (
    date.getDate()     === t.getDate()  &&
    date.getMonth()    === t.getMonth() &&
    date.getFullYear() === t.getFullYear()
  );
}

export function isPastDay(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < today;
}
