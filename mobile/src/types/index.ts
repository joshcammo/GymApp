export type WeightUnit = 'KG' | 'LBS';

export interface Exercise {
  id:         number;
  name:       string;
  date:       string;       // 'YYYY-MM-DD'
  sets:       number;
  reps?:      number | null;
  weight:     number;
  unit:       WeightUnit;
  notes?:     string | null;
  created_at: string;
  updated_at: string;
}

export interface DayInfo {
  date:         string;   // 'YYYY-MM-DD'
  dayShort:     string;   // 'MON'
  dayFull:      string;   // 'Monday'
  displayDate:  string;   // 'May 22'
  isToday:      boolean;
  isPast:       boolean;
  exercises:    Exercise[];
}

/** Navigation param types */
export type RootStackParamList = {
  Home:        undefined;
  DayDetail:   { date: string; dayFull: string };
  AddExercise: { date: string; dayFull: string; editExercise?: Exercise };
};
