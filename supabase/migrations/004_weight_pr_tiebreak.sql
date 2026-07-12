-- ================================================================
-- Migration 004: weight-PR tie-break on reps
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-003 have already been applied.
--
-- Previously, every set tied at an exercise's max weight held the
-- weight-PR badge regardless of reps. New rule: among sets tied at
-- the max weight, only the one(s) with the highest reps hold it
-- (null reps counts as 0; sets tied on both weight AND reps all
-- keep the badge, consistent with the existing equality semantics).
--
-- The save-time RPCs are updated to match, so the "new PR" badge
-- agrees with what the live view will show afterwards: a new set is
-- a weight-PR if it exceeds the prior max weight, OR equals it with
-- strictly more reps than the previous best at that weight.
--
-- e1RM logic, the lone-set rule (>= 2 comparable sets required),
-- and the first-ever-log exclusion are unchanged.
-- ================================================================

-- ── Live view: per-set flags ───────────────────────────────────
-- Output columns are unchanged, so create-or-replace is safe; the
-- body is restructured into CTEs because the tie-break needs a
-- second window pass over max_weight, which can't nest inline.
create or replace view public.exercise_set_pr_flags
with (security_invoker = true) as
with flags as (
  select
    es.id  as set_id,
    es.exercise_id,
    e.user_id,
    es.weight,
    es.reps,
    lower(btrim(e.name)) as exercise_key,
    count(*) filter (where es.weight is not null) over w as weighted_set_count,
    max(es.weight)       over w as max_weight,
    count(*) filter (where es.weight is not null and es.reps > 1) over w as e1rm_set_count,
    max(es.weight * (1 + es.reps / 30.0))
      filter (where es.weight is not null and es.reps > 1) over w as max_e1rm
  from public.exercise_sets es
  join public.exercises e on e.id = es.exercise_id
  window w as (partition by e.user_id, lower(btrim(e.name)))
),
tie as (
  select *,
    max(coalesce(reps, 0)) filter (where weight is not null and weight = max_weight)
      over (partition by user_id, exercise_key) as best_reps_at_max_weight
  from flags
)
select
  set_id,
  exercise_id,
  user_id,
  (
    weight is not null
    and weighted_set_count >= 2
    and weight = max_weight
    and coalesce(reps, 0) = best_reps_at_max_weight
  ) as is_weight_pr,
  (
    weight is not null and reps is not null and reps > 1
    and e1rm_set_count >= 2
    and (weight * (1 + reps / 30.0)) = max_e1rm
  ) as is_e1rm_pr
from tie;

-- ── create_exercise_with_sets ──────────────────────────────────
-- Signature and return type unchanged from migration 002.
create or replace function public.create_exercise_with_sets(
  p_name  text,
  p_date  date,
  p_unit  text,
  p_notes text,
  p_sets  jsonb   -- [{ "reps": 8, "weight": 60 }, ...]
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_exercise_id       bigint;
  v_set               jsonb;
  v_idx               int := 0;
  v_reps              int;
  v_weight            numeric;
  v_e1rm              numeric;
  v_prior_weight      numeric;
  -- Best reps at v_prior_weight. Invariant: non-null whenever
  -- v_prior_weight is non-null (both are always set together).
  v_prior_reps_at_max int;
  v_prior_e1rm        numeric;
  v_is_weight_pr      boolean;
  v_is_e1rm_pr        boolean;
  v_result_sets       jsonb := '[]'::jsonb;
begin
  if p_sets is null or jsonb_array_length(p_sets) < 1 or jsonb_array_length(p_sets) > 100 then
    raise exception 'sets must contain between 1 and 100 entries';
  end if;

  insert into public.exercises (user_id, name, date, unit, notes)
  values (auth.uid(), p_name, p_date, p_unit, nullif(p_notes, ''))
  returning id into v_exercise_id;

  -- Prior bests for this exercise (nothing to exclude — this is a brand
  -- new exercise row, so there's no "self" to filter out of the history).
  select max(es.weight),
         max(es.weight * (1 + es.reps / 30.0)) filter (where es.reps > 1)
    into v_prior_weight, v_prior_e1rm
  from public.exercise_sets es
  join public.exercises e on e.id = es.exercise_id
  where e.user_id = auth.uid()
    and lower(btrim(e.name)) = lower(btrim(p_name))
    and es.weight is not null;

  if v_prior_weight is not null then
    select max(coalesce(es.reps, 0))
      into v_prior_reps_at_max
    from public.exercise_sets es
    join public.exercises e on e.id = es.exercise_id
    where e.user_id = auth.uid()
      and lower(btrim(e.name)) = lower(btrim(p_name))
      and es.weight = v_prior_weight;
  end if;

  for v_set in select * from jsonb_array_elements(p_sets) loop
    v_idx    := v_idx + 1;
    v_reps   := (v_set->>'reps')::int;
    v_weight := (v_set->>'weight')::numeric;

    insert into public.exercise_sets (exercise_id, set_number, reps, weight)
    values (v_exercise_id, v_idx, v_reps, v_weight);

    -- Only a PR if there's at least one prior set to beat. Beating means
    -- more weight, or equal weight with strictly more reps.
    v_is_weight_pr := v_weight is not null and v_prior_weight is not null and (
      v_weight > v_prior_weight
      or (v_weight = v_prior_weight and coalesce(v_reps, 0) > v_prior_reps_at_max)
    );
    v_is_e1rm_pr := false;
    if v_weight is not null and v_reps is not null and v_reps > 1 then
      v_e1rm := v_weight * (1 + v_reps / 30.0);
      v_is_e1rm_pr := v_prior_e1rm is not null and v_e1rm > v_prior_e1rm;
      v_prior_e1rm := greatest(coalesce(v_prior_e1rm, v_e1rm), v_e1rm);
    end if;
    if v_weight is not null then
      if v_prior_weight is null or v_weight > v_prior_weight then
        v_prior_weight      := v_weight;
        v_prior_reps_at_max := coalesce(v_reps, 0);
      elsif v_weight = v_prior_weight then
        v_prior_reps_at_max := greatest(v_prior_reps_at_max, coalesce(v_reps, 0));
      end if;
    end if;

    v_result_sets := v_result_sets || jsonb_build_object(
      'set_number',   v_idx,
      'is_weight_pr', v_is_weight_pr,
      'is_e1rm_pr',   v_is_e1rm_pr
    );
  end loop;

  return jsonb_build_object('id', v_exercise_id, 'sets', v_result_sets);
end;
$$;

grant execute on function public.create_exercise_with_sets(text, date, text, text, jsonb) to authenticated;

-- ── update_exercise_with_sets ──────────────────────────────────
-- Signature and return type unchanged from migration 002.
create or replace function public.update_exercise_with_sets(
  p_id    bigint,
  p_name  text default null,
  p_unit  text default null,
  p_notes text default null,
  p_sets  jsonb default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_set               jsonb;
  v_idx               int := 0;
  v_reps              int;
  v_weight            numeric;
  v_e1rm              numeric;
  v_prior_weight      numeric;
  -- Best reps at v_prior_weight. Invariant: non-null whenever
  -- v_prior_weight is non-null (both are always set together).
  v_prior_reps_at_max int;
  v_prior_e1rm        numeric;
  v_is_weight_pr      boolean;
  v_is_e1rm_pr        boolean;
  v_result_sets       jsonb := '[]'::jsonb;
  v_match_name        text;
begin
  if p_sets is not null and (jsonb_array_length(p_sets) < 1 or jsonb_array_length(p_sets) > 100) then
    raise exception 'sets must contain between 1 and 100 entries';
  end if;

  update public.exercises
  set name  = coalesce(p_name,  name),
      unit  = coalesce(p_unit,  unit),
      -- p_notes = null means "not provided, leave unchanged"; p_notes = ''
      -- means "explicitly cleared" and is stored as null (see api.ts, which
      -- always sends '' instead of null to represent an empty notes field).
      notes = case when p_notes is null then notes else nullif(p_notes, '') end
  where id = p_id
  returning name into v_match_name;

  if not found then
    raise exception 'Exercise % not found or not owned by caller', p_id
      using errcode = 'P0002';
  end if;

  if p_sets is not null then
    -- Prior bests for this exercise, excluding this exercise row itself —
    -- its existing sets are about to be replaced, so they're not "prior
    -- history" to beat, they're being superseded.
    select max(es.weight),
           max(es.weight * (1 + es.reps / 30.0)) filter (where es.reps > 1)
      into v_prior_weight, v_prior_e1rm
    from public.exercise_sets es
    join public.exercises e on e.id = es.exercise_id
    where e.user_id = auth.uid()
      and e.id <> p_id
      and lower(btrim(e.name)) = lower(btrim(v_match_name))
      and es.weight is not null;

    if v_prior_weight is not null then
      select max(coalesce(es.reps, 0))
        into v_prior_reps_at_max
      from public.exercise_sets es
      join public.exercises e on e.id = es.exercise_id
      where e.user_id = auth.uid()
        and e.id <> p_id
        and lower(btrim(e.name)) = lower(btrim(v_match_name))
        and es.weight = v_prior_weight;
    end if;

    delete from public.exercise_sets where exercise_id = p_id;

    for v_set in select * from jsonb_array_elements(p_sets) loop
      v_idx    := v_idx + 1;
      v_reps   := (v_set->>'reps')::int;
      v_weight := (v_set->>'weight')::numeric;

      insert into public.exercise_sets (exercise_id, set_number, reps, weight)
      values (p_id, v_idx, v_reps, v_weight);

      v_is_weight_pr := v_weight is not null and v_prior_weight is not null and (
        v_weight > v_prior_weight
        or (v_weight = v_prior_weight and coalesce(v_reps, 0) > v_prior_reps_at_max)
      );
      v_is_e1rm_pr := false;
      if v_weight is not null and v_reps is not null and v_reps > 1 then
        v_e1rm := v_weight * (1 + v_reps / 30.0);
        v_is_e1rm_pr := v_prior_e1rm is not null and v_e1rm > v_prior_e1rm;
        v_prior_e1rm := greatest(coalesce(v_prior_e1rm, v_e1rm), v_e1rm);
      end if;
      if v_weight is not null then
        if v_prior_weight is null or v_weight > v_prior_weight then
          v_prior_weight      := v_weight;
          v_prior_reps_at_max := coalesce(v_reps, 0);
        elsif v_weight = v_prior_weight then
          v_prior_reps_at_max := greatest(v_prior_reps_at_max, coalesce(v_reps, 0));
        end if;
      end if;

      v_result_sets := v_result_sets || jsonb_build_object(
        'set_number',   v_idx,
        'is_weight_pr', v_is_weight_pr,
        'is_e1rm_pr',   v_is_e1rm_pr
      );
    end loop;
  end if;

  return jsonb_build_object('sets', v_result_sets);
end;
$$;

grant execute on function public.update_exercise_with_sets(bigint, text, text, text, jsonb) to authenticated;
