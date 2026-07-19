-- ================================================================
-- Migration 014: muscle-group training balance (heatmap)
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-013 have already been applied.
--
-- Backs the Progress screen's "Heatmap" tab: for each of the 11
-- muscle groups, how does the caller's last p_recent_days of hard
-- sets compare to their own trailing p_baseline_weeks average? This
-- is deliberately self-relative (a muscle group's own history) rather
-- than compared against other muscle groups.
--
-- Counts sets, not kg. An earlier version of this summed weight x
-- reps (public.set_volume_kg), but that makes bodyweight work
-- invisible: weight is optional for bodyweight exercises, and
-- unweighted pull-ups/push-ups/dips log with weight = null, which
-- to_kg() and set_volume_kg() correctly treat as 0 kg of volume. A
-- back day built entirely from pull-ups would then read as "well
-- under" no matter how often it's trained. Counting exercise_sets
-- rows instead — one row per hard set performed, drops included in
-- the parent set rather than counted separately, same as PR detection
-- — means a bodyweight set counts exactly the same as a loaded one.
-- This is also the standard unit strength-training volume landmarks
-- are expressed in (sets per muscle per week), not tonnage.
--
-- All 11 groups are always returned, including ones with zero history
-- in either window — the client needs to render "no data" / "just
-- started" tiles, which a plain group-by would silently drop.
--
-- baseline_weekly_avg_sets divides by however much of the
-- p_baseline_weeks window the account has actually existed for (down
-- to a 1-week floor), not always by p_baseline_weeks — an account
-- that signed up 3 weeks ago only has 3 weeks of baseline to average
-- over, and dividing its real (smaller) total by a flat 8 would
-- understate the average and make every group look falsely
-- "over-trained" for a new user's first couple of months.
-- ================================================================

-- Return columns changed (kg -> sets) from an already-applied version
-- of this migration; Postgres identifies a function by name + argument
-- types only, so `create or replace` can't change the return shape —
-- same reason migrations 006/013 drop before recreating.
drop function if exists public.muscle_group_training_balance(int, int);

create function public.muscle_group_training_balance(
  p_recent_days    int default 7,
  p_baseline_weeks int default 8
) returns table(
  muscle_group             text,
  recent_sets              int,
  baseline_weekly_avg_sets numeric
)
language sql
security invoker
as $$
  with groups as (
    select unnest(array[
      'CHEST','BACK','SHOULDERS','BICEPS','TRICEPS','FOREARMS',
      'QUADS','HAMSTRINGS','GLUTES','CALVES','CORE'
    ]) as muscle_group
  ),
  first_log as (
    -- Scoped to the same window set_counts uses below: anything older
    -- than that window only ever feeds into greatest() as a clamp
    -- target, so scanning further back than the window can reach
    -- would just cost a full-history scan for the same result.
    select min(e.date) as first_date
    from public.exercises e
    where e.user_id = auth.uid()
      and e.date > current_date - p_recent_days - p_baseline_weeks * 7
  ),
  set_counts as (
    select
      d.muscle_group,
      count(*) filter (where e.date > current_date - p_recent_days) as recent_sets,
      count(*) filter (where e.date <= current_date - p_recent_days) as baseline_sets
    from public.exercise_sets es
    join public.exercises e on e.id = es.exercise_id
    join public.exercise_defs d on d.id = e.exercise_def_id
    where e.user_id = auth.uid()
      and e.date > current_date - p_recent_days - p_baseline_weeks * 7
      -- Guard against a content-less row (schema allows reps and weight
      -- both null; only client-side validation currently prevents it)
      -- counting as a performed set.
      and (es.reps is not null or es.weight is not null)
    group by d.muscle_group
  ),
  effective as (
    -- date - date yields an integer day count in Postgres (not an
    -- interval), so this divides that integer directly rather than
    -- reaching for extract(), which needs an interval/timestamp.
    --
    -- Deliberately NOT ceil()'d to a whole week: rounding a partial
    -- window up (e.g. 10 days -> 2 weeks) shrinks the computed average
    -- below its true value, which biases towards a false "over-trained"
    -- reading for exactly the accounts this adjustment exists to
    -- protect. The greatest(1, ...) floor below still guards the
    -- near-zero-history case.
    select greatest(1, least(
      p_baseline_weeks,
      (
        (current_date - p_recent_days)
        - greatest(fl.first_date, current_date - p_recent_days - p_baseline_weeks * 7)
      )::numeric / 7.0
    )) as weeks
    from first_log fl
  )
  select
    g.muscle_group,
    coalesce(sc.recent_sets, 0)::int as recent_sets,
    coalesce(sc.baseline_sets, 0)::numeric / coalesce((select weeks from effective), p_baseline_weeks) as baseline_weekly_avg_sets
  from groups g
  left join set_counts sc on sc.muscle_group = g.muscle_group
  order by g.muscle_group;
$$;

grant execute on function public.muscle_group_training_balance(int, int) to authenticated;
