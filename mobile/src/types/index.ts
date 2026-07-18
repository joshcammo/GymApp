export type WeightUnit = 'KG' | 'LBS';

export type MuscleGroup =
  | 'CHEST' | 'BACK' | 'SHOULDERS' | 'BICEPS' | 'TRICEPS' | 'FOREARMS'
  | 'QUADS' | 'HAMSTRINGS' | 'GLUTES' | 'CALVES' | 'CORE';

/** A catalog or custom exercise definition (exercise_defs row) */
export interface ExerciseDef {
  id:               number;
  name:             string;
  muscle_group:     MuscleGroup;
  equipment:        string;
  movement_pattern: string | null;
  image_key:        string | null;
  is_custom:        boolean;
}

/** A reduced-weight continuation performed immediately after a set, no rest
 *  between. Never counts toward PR detection — only the parent set does. */
export interface DropSet {
  reps:   number | null;
  weight: number | null;
}

/** A single set within an exercise */
export interface ExerciseSet {
  id?:        number;
  set_number: number;
  reps?:      number | null;
  weight?:    number | null;
  /** Drops performed after this set, in order. Empty if none. */
  drops:      DropSet[];
}

export interface Exercise {
  id:         number;
  name:       string;
  date:       string;        // 'YYYY-MM-DD'
  unit:       WeightUnit;
  notes?:     string | null;
  sets:       ExerciseSet[]; // ordered by set_number
  created_at: string;
  updated_at: string;
  /** Catalog/custom def this entry is linked to; null only for
   *  legacy rows logged before the picker cutover. */
  exercise_def_id: number | null;
  /** True if any of this exercise's sets is currently a weight or e1RM record, computed live. */
  has_pr:     boolean;
  /** Id of the same-day exercise this is paired with as a superset, if any. Always mutual. */
  superset_partner_id: number | null;
}

export interface DayInfo {
  date:         string;   // 'YYYY-MM-DD'
  dayShort:     string;   // 'MON'
  dayFull:      string;   // 'Monday'
  dayOfMonth:   number;   // 22
  isToday:      boolean;
  isPast:       boolean;
  exercises:    Exercise[];
}

/** One exercise within a preset, in saved order. */
export interface PresetExercise {
  exercise_def_id: number;
  name:            string;
  image_key:       string | null;
  position:        number;
}

/** A named, reusable group of exercises (e.g. "Monday - Chest and Triceps"). */
export interface Preset {
  id:         number;
  name:       string;
  created_at: string;
  updated_at: string;
  exercises:  PresetExercise[];
}

/** Progress screen time-range selector. 'ALL' maps to no lower date bound. */
export type TimeRange = '4W' | '3M' | '1Y' | 'ALL';

/** One point on the 1RM trend line — the day's best estimated 1RM (Epley), kg. */
export interface OneRmTrendPoint {
  log_date: string;   // 'YYYY-MM-DD'
  e1rm_kg:  number;
}

/** One point on the weekly volume trend — total weight x reps that week, kg. */
export interface WeeklyVolumePoint {
  week_start: string;  // 'YYYY-MM-DD', Monday
  volume_kg:  number;
}

/** One slice of the muscle-group volume breakdown over a time window, kg. */
export interface MuscleGroupVolume {
  muscle_group: MuscleGroup;
  volume_kg:    number;
}

/** Navigation param types */
export type RootStackParamList = {
  Login:          undefined;
  Home:           undefined;
  Settings:       undefined;
  ChangePassword: undefined;
  DayDetail:      { date: string; dayFull: string };
  AddExercise:    { date: string; dayFull: string; editExercise?: Exercise };
  Presets:        undefined;
  EditPreset:     { preset?: Preset };
  Progress:       undefined;
};
