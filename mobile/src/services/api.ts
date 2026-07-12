import { supabase } from '../lib/supabase';
import { Exercise, WeightUnit } from '../types';

const EXERCISE_SELECT = '*, exercise_sets(*)';

interface SetRow {
  id:         number;
  set_number: number;
  reps:       number | null;
  weight:     number | null;
}

interface ExerciseRow {
  id:         number;
  name:       string;
  date:       string;
  unit:       WeightUnit;
  notes:      string | null;
  created_at: string;
  updated_at: string;
  has_pr:     boolean;
  exercise_sets: SetRow[];
}

/** Supabase embeds the child table under its own name (`exercise_sets`) —
 *  rename to `sets` and order by set_number so the shape matches `Exercise`. */
function mapRow(row: ExerciseRow): Exercise {
  return {
    id:         row.id,
    name:       row.name,
    date:       row.date,
    unit:       row.unit,
    notes:      row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    has_pr:     row.has_pr,
    sets: [...row.exercise_sets]
      .sort((a, b) => a.set_number - b.set_number)
      .map(s => ({ id: s.id, set_number: s.set_number, reps: s.reps, weight: s.weight })),
  };
}

function checkError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Payload shape for a single set on create/update */
export interface SetInput {
  reps?:   number | null;
  weight?: number | null;
}

export interface CreateExerciseDto {
  name:   string;
  date:   string;       // 'YYYY-MM-DD'
  unit:   WeightUnit;
  notes?: string | null;
  sets:   SetInput[];   // non-empty
}

/** Per-set PR flags, as returned by the create/update RPCs. */
export interface SetPrResult {
  set_number:   number;
  is_weight_pr: boolean;
  is_e1rm_pr:   boolean;
}

export interface SaveExerciseResult {
  exercise: Exercise;
  prSets:   SetPrResult[];
}

/** Live "is this set currently a record" flags, from the exercise_set_pr_flags view. */
export interface SetRecordFlags {
  set_id:       number;
  is_weight_pr: boolean;
  is_e1rm_pr:   boolean;
}

/** Fetch one exercise (with its sets) by id, in the same shape the RPCs need to return. */
async function fetchExerciseById(id: number): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises_with_pr')
    .select(EXERCISE_SELECT)
    .eq('id', id)
    .single();
  checkError(error);
  return mapRow(data as unknown as ExerciseRow);
}

export const workoutApi = {
  /** All exercises in [startDate, endDate] */
  getByRange: async (startDate: string, endDate: string): Promise<Exercise[]> => {
    const { data, error } = await supabase
      .from('exercises_with_pr')
      .select(EXERCISE_SELECT)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });
    checkError(error);
    return (data as unknown as ExerciseRow[]).map(mapRow);
  },

  /** All exercises on a single day */
  getByDate: async (date: string): Promise<Exercise[]> => {
    const { data, error } = await supabase
      .from('exercises_with_pr')
      .select(EXERCISE_SELECT)
      .eq('date', date)
      .order('created_at', { ascending: true });
    checkError(error);
    return (data as unknown as ExerciseRow[]).map(mapRow);
  },

  /** Live per-set record flags for one exercise (used by the edit screen). */
  getSetRecordFlags: async (exerciseId: number): Promise<SetRecordFlags[]> => {
    const { data, error } = await supabase
      .from('exercise_set_pr_flags')
      .select('set_id, is_weight_pr, is_e1rm_pr')
      .eq('exercise_id', exerciseId);
    checkError(error);
    return data as SetRecordFlags[];
  },

  /** Create a new exercise (with one or more sets), via the transactional RPC */
  create: async (dto: CreateExerciseDto): Promise<SaveExerciseResult> => {
    const { data, error } = await supabase.rpc('create_exercise_with_sets', {
      p_name:  dto.name,
      p_date:  dto.date,
      p_unit:  dto.unit,
      // '' (not null) tells the RPC "no notes" — see update()'s comment below.
      p_notes: dto.notes ?? '',
      p_sets:  dto.sets,
    });
    checkError(error);
    const { id, sets: prSets } = data as { id: number; sets: SetPrResult[] };
    const exercise = await fetchExerciseById(id);
    return { exercise, prSets };
  },

  /** Update an existing exercise. If `sets` is provided, all sets are replaced. */
  update: async (id: number, dto: Partial<CreateExerciseDto>): Promise<SaveExerciseResult> => {
    const { data, error } = await supabase.rpc('update_exercise_with_sets', {
      p_id:    id,
      p_name:  dto.name ?? null,
      p_unit:  dto.unit ?? null,
      // The RPC treats null as "notes not provided, leave unchanged" and ''
      // as "explicitly cleared". `dto.notes === undefined` means the caller
      // didn't touch notes at all; anything else (including null, which is
      // how AddExerciseScreen represents an emptied field) means clear it.
      p_notes: dto.notes === undefined ? null : (dto.notes ?? ''),
      p_sets:  dto.sets ?? null,
    });
    checkError(error);
    const { sets: prSets } = (data ?? { sets: [] }) as { sets: SetPrResult[] };
    const exercise = await fetchExerciseById(id);
    return { exercise, prSets };
  },

  /** Delete an exercise (cascades to its sets) */
  delete: async (id: number): Promise<void> => {
    const { data, error } = await supabase.from('exercises').delete().eq('id', id).select('id');
    checkError(error);
    if (!data || data.length === 0) {
      throw new Error('Exercise not found — it may have already been deleted.');
    }
  },
};
