-- ================================================================
-- Migration 010: drop sets
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-009 have already been applied.
--
-- A drop set is one or more reduced-weight continuations performed
-- immediately after a set, no rest between. Modeled as a `drops`
-- jsonb array directly on the set they belong to — [{ "reps": 6,
-- "weight": 40 }, ...], in performed order — rather than a child
-- table, since drops are never independently addressable (no PR
-- eligibility, no editing in isolation) and always travel with
-- their parent set's lifecycle (insert/replace/delete).
--
-- Drops never count toward PR detection. create/update_exercise_
-- with_sets and every PR view key off exercise_sets.weight/reps
-- only, which is untouched — a drop-set's reduced weight can never
-- register as a weight or e1RM record, matching how lifters
-- actually treat drop sets (the record is the working weight, the
-- drops are fatigue work). Purely additive: no existing column or
-- RPC signature changes, so create-or-replace is safe.
-- ================================================================

alter table public.exercise_sets
  add column drops jsonb not null default '[]'::jsonb
    check (jsonb_typeof(drops) = 'array');

-- ── RPC: create exercise + sets (+ drops) atomically ────────────
create or replace function public.create_exercise_with_sets(
  p_name  text,
  p_date  date,
  p_unit  text,
  p_notes text,
  p_sets  jsonb,   -- [{ "reps": 8, "weight": 60, "drops": [{ "reps": 6, "weight": 40 }] }, ...]
  p_exercise_def_id bigint default null   -- null = legacy client; no PR flags
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_exercise_id       bigint;
  v_set               jsonb;
  v_drop              jsonb;
  v_drops             jsonb;
  v_idx               int := 0;
  v_reps              int;
  v_weight            numeric;
  v_weight_kg         numeric;
  v_e1rm_kg           numeric;
  v_prior_weight_kg   numeric;
  -- Best reps at v_prior_weight_kg. Invariant: non-null whenever
  -- v_prior_weight_kg is non-null (both are always set together).
  v_prior_reps_at_max int;
  v_prior_e1rm_kg     numeric;
  v_is_weight_pr      boolean;
  v_is_e1rm_pr        boolean;
  v_result_sets       jsonb := '[]'::jsonb;
begin
  if p_sets is null or jsonb_array_length(p_sets) < 1 or jsonb_array_length(p_sets) > 100 then
    raise exception 'sets must contain between 1 and 100 entries';
  end if;

  if p_exercise_def_id is not null and not exists (
    select 1 from public.exercise_defs d
    where d.id = p_exercise_def_id
      and (d.user_id is null or d.user_id = auth.uid())
  ) then
    raise exception 'Exercise definition % not found or not accessible', p_exercise_def_id
      using errcode = 'P0002';
  end if;

  insert into public.exercises (user_id, name, date, unit, notes, exercise_def_id)
  values (auth.uid(), p_name, p_date, p_unit, nullif(p_notes, ''), p_exercise_def_id)
  returning id into v_exercise_id;

  -- Prior bests for this exercise def (kg-normalized). Legacy calls
  -- (def id null) skip PR detection entirely.
  if p_exercise_def_id is not null then
    select max(public.to_kg(es.weight, e.unit)),
           max(public.to_kg(es.weight, e.unit) * (1 + es.reps / 30.0)) filter (where es.reps > 1)
      into v_prior_weight_kg, v_prior_e1rm_kg
    from public.exercise_sets es
    join public.exercises e on e.id = es.exercise_id
    where e.user_id = auth.uid()
      and e.exercise_def_id = p_exercise_def_id
      and e.id <> v_exercise_id
      and es.weight is not null;

    if v_prior_weight_kg is not null then
      select max(coalesce(es.reps, 0))
        into v_prior_reps_at_max
      from public.exercise_sets es
      join public.exercises e on e.id = es.exercise_id
      where e.user_id = auth.uid()
        and e.exercise_def_id = p_exercise_def_id
        and e.id <> v_exercise_id
        and public.to_kg(es.weight, e.unit) = v_prior_weight_kg;
    end if;
  end if;

  for v_set in select * from jsonb_array_elements(p_sets) loop
    v_idx    := v_idx + 1;
    v_reps   := (v_set->>'reps')::int;
    v_weight := (v_set->>'weight')::numeric;
    v_drops  := coalesce(v_set->'drops', '[]'::jsonb);

    if jsonb_typeof(v_drops) <> 'array' then
      raise exception 'drops must be an array';
    end if;

    for v_drop in select * from jsonb_array_elements(v_drops) loop
      if (v_drop->>'reps') is not null and ((v_drop->>'reps')::int < 1 or (v_drop->>'reps')::int > 1000) then
        raise exception 'each drop''s reps must be between 1 and 1000';
      end if;
      if (v_drop->>'weight') is not null and (v_drop->>'weight')::numeric < 0 then
        raise exception 'each drop''s weight must be >= 0';
      end if;
    end loop;

    insert into public.exercise_sets (exercise_id, set_number, reps, weight, drops)
    values (v_exercise_id, v_idx, v_reps, v_weight, v_drops);

    v_is_weight_pr := false;
    v_is_e1rm_pr   := false;

    if p_exercise_def_id is not null then
      v_weight_kg := public.to_kg(v_weight, p_unit);

      -- Only a PR if there's at least one prior set to beat. Beating
      -- means more weight, or equal weight with strictly more reps.
      -- Drops never factor in — only the top-line reps/weight above.
      v_is_weight_pr := v_weight_kg is not null and v_prior_weight_kg is not null and (
        v_weight_kg > v_prior_weight_kg
        or (v_weight_kg = v_prior_weight_kg and coalesce(v_reps, 0) > v_prior_reps_at_max)
      );
      if v_weight_kg is not null and v_reps is not null and v_reps > 1 then
        v_e1rm_kg := v_weight_kg * (1 + v_reps / 30.0);
        v_is_e1rm_pr := v_prior_e1rm_kg is not null and v_e1rm_kg > v_prior_e1rm_kg;
        v_prior_e1rm_kg := greatest(coalesce(v_prior_e1rm_kg, v_e1rm_kg), v_e1rm_kg);
      end if;
      if v_weight_kg is not null then
        if v_prior_weight_kg is null or v_weight_kg > v_prior_weight_kg then
          v_prior_weight_kg   := v_weight_kg;
          v_prior_reps_at_max := coalesce(v_reps, 0);
        elsif v_weight_kg = v_prior_weight_kg then
          v_prior_reps_at_max := greatest(v_prior_reps_at_max, coalesce(v_reps, 0));
        end if;
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

-- ── RPC: update exercise fields and, if p_sets is provided,
--    replace all sets (+ drops) ──────────────────────────────────
create or replace function public.update_exercise_with_sets(
  p_id    bigint,
  p_name  text default null,
  p_unit  text default null,
  p_notes text default null,
  p_sets  jsonb default null,
  p_exercise_def_id bigint default null   -- null = leave unchanged
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_set               jsonb;
  v_drop              jsonb;
  v_drops             jsonb;
  v_idx               int := 0;
  v_reps              int;
  v_weight            numeric;
  v_weight_kg         numeric;
  v_e1rm_kg           numeric;
  v_prior_weight_kg   numeric;
  -- Invariant: non-null whenever v_prior_weight_kg is non-null.
  v_prior_reps_at_max int;
  v_prior_e1rm_kg     numeric;
  v_is_weight_pr      boolean;
  v_is_e1rm_pr        boolean;
  v_result_sets       jsonb := '[]'::jsonb;
  v_def_id            bigint;
  v_unit              text;
begin
  if p_sets is not null and (jsonb_array_length(p_sets) < 1 or jsonb_array_length(p_sets) > 100) then
    raise exception 'sets must contain between 1 and 100 entries';
  end if;

  if p_exercise_def_id is not null and not exists (
    select 1 from public.exercise_defs d
    where d.id = p_exercise_def_id
      and (d.user_id is null or d.user_id = auth.uid())
  ) then
    raise exception 'Exercise definition % not found or not accessible', p_exercise_def_id
      using errcode = 'P0002';
  end if;

  update public.exercises
  set name  = coalesce(p_name,  name),
      unit  = coalesce(p_unit,  unit),
      -- p_notes = null means "not provided, leave unchanged"; p_notes = ''
      -- means "explicitly cleared" and is stored as null (see api.ts, which
      -- always sends '' instead of null to represent an empty notes field).
      notes = case when p_notes is null then notes else nullif(p_notes, '') end,
      exercise_def_id = coalesce(p_exercise_def_id, exercise_def_id)
  where id = p_id
  returning exercise_def_id, unit into v_def_id, v_unit;

  if not found then
    raise exception 'Exercise % not found or not owned by caller', p_id
      using errcode = 'P0002';
  end if;

  if p_sets is not null then
    -- Prior bests for this def (kg-normalized), excluding this exercise
    -- row itself — its sets are being replaced, not competed against.
    if v_def_id is not null then
      select max(public.to_kg(es.weight, e.unit)),
             max(public.to_kg(es.weight, e.unit) * (1 + es.reps / 30.0)) filter (where es.reps > 1)
        into v_prior_weight_kg, v_prior_e1rm_kg
      from public.exercise_sets es
      join public.exercises e on e.id = es.exercise_id
      where e.user_id = auth.uid()
        and e.id <> p_id
        and e.exercise_def_id = v_def_id
        and es.weight is not null;

      if v_prior_weight_kg is not null then
        select max(coalesce(es.reps, 0))
          into v_prior_reps_at_max
        from public.exercise_sets es
        join public.exercises e on e.id = es.exercise_id
        where e.user_id = auth.uid()
          and e.id <> p_id
          and e.exercise_def_id = v_def_id
          and public.to_kg(es.weight, e.unit) = v_prior_weight_kg;
      end if;
    end if;

    delete from public.exercise_sets where exercise_id = p_id;

    for v_set in select * from jsonb_array_elements(p_sets) loop
      v_idx    := v_idx + 1;
      v_reps   := (v_set->>'reps')::int;
      v_weight := (v_set->>'weight')::numeric;
      v_drops  := coalesce(v_set->'drops', '[]'::jsonb);

      if jsonb_typeof(v_drops) <> 'array' then
        raise exception 'drops must be an array';
      end if;

      for v_drop in select * from jsonb_array_elements(v_drops) loop
        if (v_drop->>'reps') is not null and ((v_drop->>'reps')::int < 1 or (v_drop->>'reps')::int > 1000) then
          raise exception 'each drop''s reps must be between 1 and 1000';
        end if;
        if (v_drop->>'weight') is not null and (v_drop->>'weight')::numeric < 0 then
          raise exception 'each drop''s weight must be >= 0';
        end if;
      end loop;

      insert into public.exercise_sets (exercise_id, set_number, reps, weight, drops)
      values (p_id, v_idx, v_reps, v_weight, v_drops);

      v_is_weight_pr := false;
      v_is_e1rm_pr   := false;

      if v_def_id is not null then
        v_weight_kg := public.to_kg(v_weight, v_unit);

        v_is_weight_pr := v_weight_kg is not null and v_prior_weight_kg is not null and (
          v_weight_kg > v_prior_weight_kg
          or (v_weight_kg = v_prior_weight_kg and coalesce(v_reps, 0) > v_prior_reps_at_max)
        );
        if v_weight_kg is not null and v_reps is not null and v_reps > 1 then
          v_e1rm_kg := v_weight_kg * (1 + v_reps / 30.0);
          v_is_e1rm_pr := v_prior_e1rm_kg is not null and v_e1rm_kg > v_prior_e1rm_kg;
          v_prior_e1rm_kg := greatest(coalesce(v_prior_e1rm_kg, v_e1rm_kg), v_e1rm_kg);
        end if;
        if v_weight_kg is not null then
          if v_prior_weight_kg is null or v_weight_kg > v_prior_weight_kg then
            v_prior_weight_kg   := v_weight_kg;
            v_prior_reps_at_max := coalesce(v_reps, 0);
          elsif v_weight_kg = v_prior_weight_kg then
            v_prior_reps_at_max := greatest(v_prior_reps_at_max, coalesce(v_reps, 0));
          end if;
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
