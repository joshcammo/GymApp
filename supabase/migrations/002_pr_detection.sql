-- ================================================================
-- Migration 002: personal-record (PR) detection
--
-- Run this once in the Supabase SQL editor against a project where
-- supabase/schema.sql and migrations/001 have already been applied.
--
-- A set is a PR if, against that exercise's prior history (matched
-- by user_id + case/whitespace-insensitive name, excluding the
-- exercise row currently being edited/replaced), it is either:
--   - a new heaviest weight ever logged, at any rep count, or
--   - a new best estimated 1RM (Epley: weight * (1 + reps/30)),
--     only considered when reps > 1.
-- A set is never flagged as a PR unless there is at least one prior
-- set for that exercise already (the first-ever log of an exercise
-- is not treated as a PR). PR flags are not persisted — they're
-- computed at save time and returned to the caller only, so a badge
-- never goes stale as later sets overtake it.
-- ================================================================

-- Speeds up matching "this exercise" across a user's history by
-- normalized name — the join every PR check below performs.
create index idx_exercises_user_name on public.exercises (user_id, lower(btrim(name)));

-- ── create_exercise_with_sets ──────────────────────────────────
-- Return type changes (bigint -> jsonb), so the old function must
-- be dropped before it can be recreated.
drop function if exists public.create_exercise_with_sets(text, date, text, text, jsonb);

create function public.create_exercise_with_sets(
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
  v_exercise_id   bigint;
  v_set           jsonb;
  v_idx           int := 0;
  v_reps          int;
  v_weight        numeric;
  v_e1rm          numeric;
  v_prior_weight  numeric;
  v_prior_e1rm    numeric;
  v_is_weight_pr  boolean;
  v_is_e1rm_pr    boolean;
  v_result_sets   jsonb := '[]'::jsonb;
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

  for v_set in select * from jsonb_array_elements(p_sets) loop
    v_idx    := v_idx + 1;
    v_reps   := (v_set->>'reps')::int;
    v_weight := (v_set->>'weight')::numeric;

    insert into public.exercise_sets (exercise_id, set_number, reps, weight)
    values (v_exercise_id, v_idx, v_reps, v_weight);

    -- Only a PR if there's at least one prior set to beat.
    v_is_weight_pr := v_weight is not null and v_prior_weight is not null and v_weight > v_prior_weight;
    v_is_e1rm_pr   := false;
    if v_weight is not null and v_reps is not null and v_reps > 1 then
      v_e1rm := v_weight * (1 + v_reps / 30.0);
      v_is_e1rm_pr := v_prior_e1rm is not null and v_e1rm > v_prior_e1rm;
      v_prior_e1rm := greatest(coalesce(v_prior_e1rm, v_e1rm), v_e1rm);
    end if;
    if v_weight is not null then
      v_prior_weight := greatest(coalesce(v_prior_weight, v_weight), v_weight);
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
-- Return type changes (void -> jsonb), so the old function must be
-- dropped before it can be recreated.
drop function if exists public.update_exercise_with_sets(bigint, text, text, text, jsonb);

create function public.update_exercise_with_sets(
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
  v_set           jsonb;
  v_idx           int := 0;
  v_reps          int;
  v_weight        numeric;
  v_e1rm          numeric;
  v_prior_weight  numeric;
  v_prior_e1rm    numeric;
  v_is_weight_pr  boolean;
  v_is_e1rm_pr    boolean;
  v_result_sets   jsonb := '[]'::jsonb;
  v_match_name    text;
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

    delete from public.exercise_sets where exercise_id = p_id;

    for v_set in select * from jsonb_array_elements(p_sets) loop
      v_idx    := v_idx + 1;
      v_reps   := (v_set->>'reps')::int;
      v_weight := (v_set->>'weight')::numeric;

      insert into public.exercise_sets (exercise_id, set_number, reps, weight)
      values (p_id, v_idx, v_reps, v_weight);

      v_is_weight_pr := v_weight is not null and v_prior_weight is not null and v_weight > v_prior_weight;
      v_is_e1rm_pr   := false;
      if v_weight is not null and v_reps is not null and v_reps > 1 then
        v_e1rm := v_weight * (1 + v_reps / 30.0);
        v_is_e1rm_pr := v_prior_e1rm is not null and v_e1rm > v_prior_e1rm;
        v_prior_e1rm := greatest(coalesce(v_prior_e1rm, v_e1rm), v_e1rm);
      end if;
      if v_weight is not null then
        v_prior_weight := greatest(coalesce(v_prior_weight, v_weight), v_weight);
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
