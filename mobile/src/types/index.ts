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

/** The caller's own profile, or another user's as surfaced by search/friend views. */
export interface Profile {
  id:           string;
  username:     string | null;
  display_name: string | null;
}

export type FriendshipStatus = 'pending' | 'accepted';

/** One row from `friendships_with_profiles` — a friendship from the caller's point of view. */
export interface Friendship {
  id:                  number;
  status:              FriendshipStatus;
  created_at:          string;
  responded_at:        string | null;
  /** True if the caller sent this request (vs. received it). */
  is_requester:        boolean;
  other_user_id:       string;
  other_username:      string | null;
  other_display_name:  string | null;
}

/** One row from `posts_feed` — a shared lift, with author + engagement counts baked in. */
export interface Post {
  id:            number;
  user_id:       string;
  exercise_name: string;
  weight:        number;
  reps:          number | null;
  unit:          WeightUnit;
  e1rm_kg:       number | null;
  caption:       string | null;
  created_at:    string;
  username:      string | null;
  display_name:  string | null;
  like_count:    number;
  liked_by_me:   boolean;
  comment_count: number;
}

/** One row from `post_comments_with_profiles`. */
export interface PostComment {
  id:           number;
  post_id:      number;
  user_id:      string;
  body:         string;
  created_at:   string;
  username:     string | null;
  display_name: string | null;
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
  Social:          undefined;
  Friends:         undefined;
  PostDetail:      { postId: number };
  UsernameSetup:   undefined;
  ChangeUsername:  undefined;
};
