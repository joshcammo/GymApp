-- ================================================================
-- Migration 020: dashboard analytics
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-019 have already been applied.
--
-- Two read-only RPCs backing the Home dashboard's trend chart and
-- badge row. Both are security invoker and filter on auth.uid()
-- explicitly (belt-and-braces alongside RLS), same as every other
-- analytics RPC since migration 011.
--
-- Volume reuses public.set_volume_kg() from migration 011, so the
-- dashboard's numbers are computed identically to the Progress
-- screen's — kg-normalized, drops included — and the two can never
-- disagree about what "volume" means.
-- ================================================================

-- ── Daily activity for the last N days ──────────────────────────
-- Zero-filled via generate_series: a rest day is a real 0 in the
-- series, not a missing point, so the trend line doesn't silently
-- close the gap between two training days and overstate consistency.
create or replace function public.get_daily_activity(p_days int default 30)
returns table (
  activity_date  date,
  exercise_count int,
  cardio_count   int,
  volume_kg      numeric
)
language sql
stable
security invoker
as $$
  -- The clamp is repeated rather than hoisted into a CTE: the window start
  -- is needed inside generate_series() in the FROM clause, and inlining it
  -- keeps that a plain expression instead of a cross-FROM reference.
  with ex as (
    select e.date as on_date,
           count(distinct e.id)::int as cnt,
           coalesce(sum(public.set_volume_kg(es.weight, es.reps, es.drops, e.unit)), 0) as volume
    from public.exercises e
    left join public.exercise_sets es on es.exercise_id = e.id
    where e.user_id = auth.uid()
      and e.date > current_date - greatest(least(coalesce(p_days, 30), 90), 1)
    group by e.date
  ),
  cardio as (
    select c.date as on_date, count(*)::int as cnt
    from public.cardio_sessions c
    where c.user_id = auth.uid()
      and c.date > current_date - greatest(least(coalesce(p_days, 30), 90), 1)
    group by c.date
  )
  select
    d.day::date                        as activity_date,
    coalesce(ex.cnt, 0)                as exercise_count,
    coalesce(cardio.cnt, 0)            as cardio_count,
    round(coalesce(ex.volume, 0), 2)   as volume_kg
  from generate_series(
    (current_date - greatest(least(coalesce(p_days, 30), 90), 1) + 1)::timestamp,
    current_date::timestamp,
    interval '1 day'
  ) as d(day)
  left join ex     on ex.on_date     = d.day::date
  left join cardio on cardio.on_date = d.day::date
  order by activity_date;
$$;

grant execute on function public.get_daily_activity(int) to authenticated;

-- ── Lifetime stats backing the dashboard's badges ───────────────
-- Returned as one jsonb object rather than a row so adding a future
-- badge input doesn't change the function signature (which would
-- otherwise need a drop + recreate, and a coordinated client deploy).
--
-- longest_streak is a gaps-and-islands count: consecutive training
-- dates share (date - row_number()), so grouping on that expression
-- yields one group per unbroken run.
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
  )
  select jsonb_build_object(
    'total_training_days', (select count(*)::int from training_days),
    'total_exercises',     (select count(*)::int from public.exercises
                            where user_id = auth.uid() and date <= current_date),
    'total_cardio',        (select count(*)::int from public.cardio_sessions
                            where user_id = auth.uid() and date <= current_date),
    'longest_streak',      coalesce((select max(len) from runs), 0),
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
