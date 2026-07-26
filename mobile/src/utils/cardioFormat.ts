import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CardioActivityType } from '../types';

/** Label + icon for each loggable activity type, in picker/display order. */
export const CARDIO_ACTIVITY_META: Record<
  CardioActivityType,
  { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  run:   { label: 'Run',   icon: 'run' },
  bike:  { label: 'Bike',  icon: 'bike' },
  walk:  { label: 'Walk',  icon: 'walk' },
  hike:  { label: 'Hike',  icon: 'hiking' },
  swim:  { label: 'Swim',  icon: 'swim' },
  other: { label: 'Other', icon: 'dots-horizontal-circle-outline' },
};

export const CARDIO_ACTIVITY_TYPES = Object.keys(CARDIO_ACTIVITY_META) as CardioActivityType[];

/** 45 -> '45 min', 90 -> '1h 30m', 3600 -> '1h' */
export function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours   = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** 5200 -> '5.2 km', null -> null */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters == null) return null;
  return `${(meters / 1000).toFixed(1)} km`;
}
