import { supabase } from '../lib/supabase';
import { Exercise, ExerciseDef, MuscleGroup, WeightUnit } from '../types';

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
  exercise_def_id: number | null;
  has_pr:     boolean;
  superset_partner_id: number | null;
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
    exercise_def_id: row.exercise_def_id,
    has_pr:     row.has_pr,
    superset_partner_id: row.superset_partner_id,
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
  /** Catalog/custom def id. Always set by the picker flow. */
  exerciseDefId?: number | null;
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
      p_exercise_def_id: dto.exerciseDefId ?? null,
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
      // null = leave the existing link unchanged
      p_exercise_def_id: dto.exerciseDefId ?? null,
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

  /** Link two same-day exercises as a superset, or unlink with partnerId = null. */
  setSupersetPartner: async (exerciseId: number, partnerId: number | null): Promise<void> => {
    const { error } = await supabase.rpc('set_superset_partner', {
      p_exercise_id: exerciseId,
      p_partner_id:  partnerId,
    });
    checkError(error);
  },
};

// ── Exercise catalog ─────────────────────────────────────────────

interface ExerciseDefRow {
  id:               number;
  user_id:          string | null;
  name:             string;
  muscle_group:     MuscleGroup;
  equipment:        string;
  movement_pattern: string | null;
  image_key:        string | null;
}

/** One "did you mean?" candidate from create_custom_exercise. */
export interface CustomSuggestion {
  id:           number;
  name:         string;
  muscle_group: MuscleGroup;
  is_custom:    boolean;
  similarity:   number;
}

export type CreateCustomResult =
  | { created: true;  def: { id: number; name: string; muscle_group: MuscleGroup; equipment: string } }
  | { created: false; suggestions: CustomSuggestion[] };

/** Best current lifts for one exercise def, or nulls if never logged. */
export interface ExercisePr {
  best_weight: { weight: number; unit: WeightUnit; reps: number | null } | null;
  best_e1rm:   { weight: number; unit: WeightUnit; reps: number; e1rm_kg: number } | null;
}

export const catalogApi = {
  /** Global catalog + the caller's customs (RLS scopes the rest out). */
  list: async (): Promise<ExerciseDef[]> => {
    const { data, error } = await supabase
      .from('exercise_defs')
      .select('id, user_id, name, muscle_group, equipment, movement_pattern, image_key')
      .order('name', { ascending: true });
    checkError(error);
    return (data as ExerciseDefRow[]).map(d => ({
      id:               d.id,
      name:             d.name,
      muscle_group:     d.muscle_group,
      equipment:        d.equipment,
      movement_pattern: d.movement_pattern,
      image_key:        d.image_key,
      is_custom:        d.user_id !== null,
    }));
  },

  /** Create a custom exercise; may return near-match suggestions instead. */
  createCustom: async (
    name: string, muscleGroup: MuscleGroup, equipment: string, force = false,
  ): Promise<CreateCustomResult> => {
    const { data, error } = await supabase.rpc('create_custom_exercise', {
      p_name:         name,
      p_muscle_group: muscleGroup,
      p_equipment:    equipment,
      p_force:        force,
    });
    checkError(error);
    return data as CreateCustomResult;
  },

  /** Current best weight set and best e1RM set for a def (kg-compared server-side). */
  getPr: async (exerciseDefId: number): Promise<ExercisePr> => {
    const { data, error } = await supabase.rpc('get_exercise_pr', {
      p_exercise_def_id: exerciseDefId,
    });
    checkError(error);
    return data as ExercisePr;
  },
};
