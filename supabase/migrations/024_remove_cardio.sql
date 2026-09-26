-- ================================================================
-- Migration 024: remove cardio
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-021 and 023 have already been applied (022 is still
-- reserved by an unmerged branch and doesn't touch cardio).
--
-- Cardio is no longer part of the app. This rewrites the two
-- dashboard functions that read public.cardio_sessions so they count
-- strength training only, drops the unused streak function and the
-- two cardio RPCs, and drops the table itself.
--
-- !! DESTRUCTIVE: dropping cardio_sessions permanently deletes every
-- !! cardio session. There is no undo. Before running, check what's
-- !! there and export it if you want a copy (Table Editor → cardio_sessions
-- !! → Export to CSV):
-- !!
-- !!   select count(*) as sessions, count(distinct user_id) as users
-- !!   from public.cardio_sessions;
--
-- ORDERING: run this only after the app build without cardio has
-- reached every tester. An older build still queries cardio_sessions
-- on the Home, Workout and Day screens, and those screens fail to load
-- once the table is gone.
--
-- Why one DO block: the SQL editor doesn't guarantee consecutive
-- statements share a session, and begin/commit gives no real
-- atomicity there. A single DO block is one statement, so either all
-- of this applies or none of it does. Every step is also safe to
-- re-run (create or replace / if exists).
--
-- Function-by-function:
--
--   get_achievement_stats()  jsonb result, so dropping the
--                            'total_cardio' key needs no signature
--                            change. Older builds read it as undefined.
--   get_daily_activity(int)  the cardio_count column goes, which changes
--                            the return type, so drop and recreate.
--   get_current_streak()     dropped: unused since the streak banner
--                            went, and it read cardio_sessions.
--
-- Dropping the table also drops its indexes, RLS policies and
-- updated_at trigger. The account-deletion cascade (migration 023)
-- needs no change: it relies on ON DELETE CASCADE per table, not on a
-- list of tables.
-- ================================================================

do $migration$
begin

  -- ── Lifetime stats: training days and totals from exercises only ──
  execute $fn$
    create or replace function public.get_achievement_stats()
    returns jsonb
    language sql
    stable
    security invoker
    as $$
      with training_days as (
        select distinct date as on_date from public.exercises
        where user_id = auth.uid() and date <= current_date
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
  $fn$;

  -- ── Daily activity: cardio_count column removed ─────────────────
  drop function if exists public.get_daily_activity(int);

  execute $fn$
    create function public.get_daily_activity(p_days int default 30)
    returns table (
      activity_date  date,
      exercise_count int,
      volume_kg      numeric
    )
    language sql
    stable
    security invoker
    as $$
      with ex as (
        select e.date as on_date,
               count(distinct e.id)::int as cnt,
               coalesce(sum(public.set_volume_kg(es.weight, es.reps, es.drops, e.unit)), 0) as volume
        from public.exercises e
        left join public.exercise_sets es on es.exercise_id = e.id
        where e.user_id = auth.uid()
          and e.date > current_date - greatest(least(coalesce(p_days, 30), 90), 1)
        group by e.date
      )
      select
        d.day::date                        as activity_date,
        coalesce(ex.cnt, 0)                as exercise_count,
        round(coalesce(ex.volume, 0), 2)   as volume_kg
      from generate_series(
        (current_date - greatest(least(coalesce(p_days, 30), 90), 1) + 1)::timestamp,
        current_date::timestamp,
        interval '1 day'
      ) as d(day)
      left join ex on ex.on_date = d.day::date
      order by activity_date;
    $$;
  $fn$;

  -- A recreated function gets Postgres's default EXECUTE to PUBLIC;
  -- revoke it, same as migration 023, so only signed-in users can call it.
  revoke execute on function public.get_daily_activity(int) from public;
  grant execute on function public.get_daily_activity(int) to authenticated;

  -- ── Current streak: unused since the streak banner was removed ──
  -- It read cardio_sessions, so it would error once the table is gone.
  -- Nothing in the app calls it, so drop it rather than rewrite it.
  drop function if exists public.get_current_streak();

  -- ── Cardio RPCs and table ───────────────────────────────────────
  drop function if exists public.create_cardio_session(text, date, int, numeric, text);
  drop function if exists public.update_cardio_session(bigint, text, int, numeric, boolean, text);
  drop table if exists public.cardio_sessions;

end
$migration$;
