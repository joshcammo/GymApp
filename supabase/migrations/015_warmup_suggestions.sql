-- ================================================================
-- Migration 015: warm-up suggestions
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-014 have already been applied.
--
-- Backs the "Suggested Warm-up" section on the Add/Edit Exercise
-- screen: a percentage ramp (40/60/80%) computed client-side from the
-- heaviest weighted set of the *most recent* session logged against
-- this exercise def, not the all-time PR (get_exercise_pr, migration
-- 006). PR weight can be stale — a lift trained months ago at a
-- since-abandoned max would suggest warm-ups sized for a much heavier
-- session than the one actually being logged today. Same auth.uid()
-- + exercise_def_id scoping and to_kg()-based ordering as
-- get_exercise_pr, just ordered by session recency first.
-- ================================================================

create function public.get_last_working_set(p_exercise_def_id bigint)
returns jsonb
language sql
security invoker
as $$
  select (
    select jsonb_build_object('weight', s.weight, 'unit', e.unit, 'reps', s.reps, 'date', e.date)
    from public.exercise_sets s
    join public.exercises e on e.id = s.exercise_id
    where e.user_id = auth.uid()
      and e.exercise_def_id = p_exercise_def_id
      and s.weight is not null and s.weight > 0
    order by e.date desc, e.created_at desc,
             public.to_kg(s.weight, e.unit) desc, coalesce(s.reps, 0) desc, s.id
    limit 1
  );
$$;

grant execute on function public.get_last_working_set(bigint) to authenticated;
