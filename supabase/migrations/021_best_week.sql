-- ================================================================
-- Migration 021: best training week
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-020 have already been applied.
--
-- Adds one key to get_achievement_stats(): best_week_days, the most
-- distinct days trained inside a single calendar week. It replaces
-- longest_streak as the input to the dashboard's weekly badge.
--
-- Why: a consecutive-day streak treats rest as failure, which is the
-- opposite of how training actually works. Counting days per week
-- rewards frequency while leaving room to recover.
--
-- longest_streak is deliberately kept in the payload. Nothing renders
-- it after this migration, but dropping a key from the jsonb result
-- would break any client still on the previous build.
--
-- The function returns jsonb, so adding a key needs no drop and no
-- coordinated client deploy: older builds ignore what they don't read.
-- ================================================================

-- Weeks are Monday-based (date_trunc('week', ...) is ISO), matching
-- getWeekStart() in the app, so the badge and the dashboard hero
-- always agree about which days belong to "this week".
create or replace function public.get_achievement_stats()
returns jsonb
language sql
stable
security invoker
as $$
  -- Every aggregate here is bounded at current_date. Nothing stops a user
  -- logging against a future day (the week view lets you open one), and a
  -- planned session shouldn't count toward a badge or extend a streak
  -- before it's actually been done.
  with training_days as (
    select distinct on_date from (
      select date as on_date from public.exercises
      where user_id = auth.uid() and date <= current_date
      union
      select date as on_date from public.cardio_sessions
      where user_id = auth.uid() and date <= current_date
    ) d
  ),
  islands as (
    select on_date - (row_number() over (order by on_date))::int as grp
    from training_days
  ),
  runs as (
    select count(*)::int as len from islands group by grp
  ),
  weeks as (
    select count(*)::int as days_trained
    from training_days
    group by date_trunc('week', on_date)
  )
  select jsonb_build_object(
    'total_training_days', (select count(*)::int from training_days),
    'total_exercises',     (select count(*)::int from public.exercises
                            where user_id = auth.uid() and date <= current_date),
    'total_cardio',        (select count(*)::int from public.cardio_sessions
                            where user_id = auth.uid() and date <= current_date),
    'longest_streak',      coalesce((select max(len) from runs), 0),
    'best_week_days',      coalesce((select max(days_trained) from weeks), 0),
    'total_volume_kg',     coalesce((
                             select round(sum(public.set_volume_kg(es.weight, es.reps, es.drops, e.unit)), 2)
                             from public.exercises e
                             join public.exercise_sets es on es.exercise_id = e.id
                             where e.user_id = auth.uid()
                               and e.date <= current_date
                           ), 0),
    'muscle_groups_last_7d', (
                             select count(distinct defs.muscle_group)::int
                             from public.exercises e
                             join public.exercise_defs defs on defs.id = e.exercise_def_id
                             where e.user_id = auth.uid()
                               and e.date between current_date - 6 and current_date
                           )
  );
$$;

grant execute on function public.get_achievement_stats() to authenticated;
