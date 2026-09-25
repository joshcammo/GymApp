-- ================================================================
-- Migration 022: PR source location
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-021 have already been applied.
--
-- Extends get_exercise_pr() (migration 006) so each PR object also
-- carries the date and exercise_id it was set on. The "Current PR"
-- chip in AddExerciseScreen can then jump straight to the day and
-- exercise where the record was hit, instead of just showing the
-- number.
--
-- Same tie-break as the original query (highest kg-normalized
-- weight, then most reps, then set id) — adding columns to the
-- select list doesn't change which row wins.
-- ================================================================

create or replace function public.get_exercise_pr(p_exercise_def_id bigint)
returns jsonb
language sql
security invoker
as $$
  select jsonb_build_object(
    'best_weight', (
      select jsonb_build_object(
        'weight', s.weight, 'unit', e.unit, 'reps', s.reps,
        'date', e.date, 'exercise_id', e.id)
      from public.exercise_sets s
      join public.exercises e on e.id = s.exercise_id
      where e.user_id = auth.uid()
        and e.exercise_def_id = p_exercise_def_id
        and s.weight is not null
      order by public.to_kg(s.weight, e.unit) desc, coalesce(s.reps, 0) desc, s.id
      limit 1
    ),
    'best_e1rm', (
      select jsonb_build_object(
        'weight', s.weight, 'unit', e.unit, 'reps', s.reps,
        'e1rm_kg', round(public.to_kg(s.weight, e.unit) * (1 + s.reps / 30.0), 1),
        'date', e.date, 'exercise_id', e.id)
      from public.exercise_sets s
      join public.exercises e on e.id = s.exercise_id
      where e.user_id = auth.uid()
        and e.exercise_def_id = p_exercise_def_id
        and s.weight is not null and s.reps > 1
      order by public.to_kg(s.weight, e.unit) * (1 + s.reps / 30.0) desc, s.id
      limit 1
    )
  );
$$;

grant execute on function public.get_exercise_pr(bigint) to authenticated;
