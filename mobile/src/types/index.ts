export type WeightUnit = 'KG' | 'LBS';

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
  ForgotPassword: undefined;
  ResetPassword:  undefined;
  Home:           undefined;
  DayDetail:      { date: string; dayFull: string };
  AddExercise:    { date: string; dayFull: string; editExercise?: Exercise };
};