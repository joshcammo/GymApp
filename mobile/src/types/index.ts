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

/** A single set within an exercise */
export interface ExerciseSet {
  id?:        number;
  set_number: number;
  reps?:      number | null;
  weight?:    number | null;
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

/** Navigation param types */
export type RootStackParamList = {
  Login:          undefined;
  Home:           undefined;
  Settings:       undefined;
  ChangePassword: undefined;
  DayDetail:      { date: string; dayFull: string };
  AddExercise:    { date: string; dayFull: string; editExercise?: Exercise };
};
