-- ================================================================
-- Migration 011: progress / analytics views
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-010 have already been applied.
--
-- Three read-only RPCs backing the Progress screen. All of them key
-- off exercises.exercise_def_id (unlinked rows are excluded via the
-- inner join to exercise_defs — there are none as of this writing,
-- but the exclusion is structural, not incidental) and normalize
-- weight through the existing public.to_kg() helper from migration
-- 006, so mixed KG/LBS history is never summed or compared as raw
-- numbers. security invoker, same as every other RPC/view in this
-- project — RLS on exercises/exercise_sets does the per-user
-- filtering, and the explicit e.user_id = auth.uid() filter below
-- matches the belt-and-braces style already used in get_exercise_pr.
--
-- Drop sets (migration 010) are deliberately excluded from 1RM
-- calculation, same as PR detection — a drop is fatigue work at a
-- reduced weight, not a fresh single-rep-max data point. They ARE
-- included in volume, via set_volume_kg() below: a drop is still
-- real weight x reps performed, and "volume" undercounts actual
-- training load if it only counts top-line sets.
-- ================================================================

-- ── Volume of one set (top-line weight/reps + every drop), kg ───
create function public.set_volume_kg(
  p_weight numeric,
  p_reps   int,
  p_drops  jsonb,
  p_unit   text
) returns numeric
language sql
immutable
as $$
  select coalesce(public.to_kg(p_weight, p_unit) * p_reps, 0)
    + coalesce((
        select sum(public.to_kg((d->>'weight')::numeric, p_unit) * (d->>'reps')::int)
        from jsonb_array_elements(coalesce(p_drops, '[]'::jsonb)) as d
        where (d->>'weight') is not null and (d->>'reps') is not null
      ), 0);
$$;

grant execute on function public.set_volume_kg(numeric, int, jsonb, text) to authenticated;

-- ── 1RM trend: best Epley e1RM per day, one exercise def ────────
-- Same formula as exercise_set_pr_flags (migration 006): weight_kg *
-- (1 + reps/30.0), reps > 1 only. One point per day (the day's best
-- effort) rather than one point per set, so the line reflects
-- progression instead of every individual set logged that day.
create function public.exercise_1rm_trend(
  p_exercise_def_id bigint,
  p_since           date default null
) returns table(log_date date, e1rm_kg numeric)
language sql
security invoker
as $$
  select
    e.date as log_date,
    max(public.to_kg(es.weight, e.unit) * (1 + es.reps / 30.0)) as e1rm_kg
  from public.exercise_sets es
  join public.exercises e on e.id = es.exercise_id
  join public.exercise_defs d on d.id = e.exercise_def_id
  where e.user_id = auth.uid()
    and e.exercise_def_id = p_exercise_def_id
    and (p_since is null or e.date >= p_since)
    and es.weight is not null
    and es.reps is not null
    and es.reps > 1
  group by e.date
  order by e.date;
$$;

grant execute on function public.exercise_1rm_trend(bigint, date) to authenticated;

-- ── Weekly volume trend: single exercise OR whole muscle group ──
-- Exactly one of p_exercise_def_id / p_muscle_group must be given —
-- summing "all exercises across all muscle groups" isn't a
-- meaningful trend line, so this is enforced rather than silently
-- falling back to an unfiltered total.
create function public.weekly_volume_trend(
  p_exercise_def_id bigint default null,
  p_muscle_group    text default null,
  p_since           date default null
) returns table(week_start date, volume_kg numeric)
language plpgsql
security invoker
as $$
begin
  if (p_exercise_def_id is null) = (p_muscle_group is null) then
    raise exception 'exactly one of p_exercise_def_id or p_muscle_group must be provided';
  end if;

  return query
  select
    date_trunc('week', e.date)::date as week_start,
    sum(public.set_volume_kg(es.weight, es.reps, es.drops, e.unit)) as volume_kg
  from public.exercise_sets es
  join public.exercises e on e.id = es.exercise_id
  join public.exercise_defs d on d.id = e.exercise_def_id
  where e.user_id = auth.uid()
    and (p_since is null or e.date >= p_since)
    and (
      (p_exercise_def_id is not null and e.exercise_def_id = p_exercise_def_id)
      or (p_muscle_group is not null and d.muscle_group = p_muscle_group)
    )
  group by 1
  order by 1;
end;
$$;

grant execute on function public.weekly_volume_trend(bigint, text, date) to authenticated;

-- ── Muscle group breakdown: total volume per primary muscle group ─
-- Keys off exercise_defs.muscle_group (primary) only, not
-- secondary_muscles — a set's volume can only be attributed to one
-- slice of the breakdown, or the total wouldn't sum to 100%.
create function public.muscle_group_volume_breakdown(
  p_since date default null
) returns table(muscle_group text, volume_kg numeric)
language sql
security invoker
as $$
  select
    d.muscle_group,
    sum(public.set_volume_kg(es.weight, es.reps, es.drops, e.unit)) as volume_kg
  from public.exercise_sets es
  join public.exercises e on e.id = es.exercise_id
  join public.exercise_defs d on d.id = e.exercise_def_id
  where e.user_id = auth.uid()
    and (p_since is null or e.date >= p_since)
  group by d.muscle_group
  order by volume_kg desc;
$$;

grant execute on function public.muscle_group_volume_breakdown(date) to authenticated;
