-- ================================================================
-- Migration 006: catalog cutover
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-005 AND the history remap (scripts/) have been
-- applied. Apply this BEFORE merging the picker app update — the
-- new RPC signatures default p_exercise_def_id to null, so old app
-- versions keep working (their logs simply land unlinked and get
-- caught by the post-cutover straggler remap pass).
--
-- What changes:
--   1. Exercise identity for ALL PR logic switches from
--      lower(btrim(name)) matching to exercises.exercise_def_id.
--      Unlinked rows (def id null) never hold or contest PRs.
--   2. Weight comparisons normalize LBS -> KG (x 0.45359237) so
--      mixed-unit history compares real mass. Display values are
--      untouched — normalization exists only inside comparisons.
--   3. create/update_exercise_with_sets gain p_exercise_def_id
--      (validated against the caller's visible defs).
--   4. New RPC create_custom_exercise: trigram "did you mean?"
--      guard over the caller's customs + the global catalog;
--      p_force bypasses near-matches but never exact catalog ones.
--   5. New RPC get_exercise_pr: current best weight set and best
--      e1RM set for one exercise def, for the picker's PR chip.
-- ================================================================

-- ── Unit normalization helper ───────────────────────────────────
create or replace function public.to_kg(p_weight numeric, p_unit text)
returns numeric
language sql
immutable
as $$
  select p_weight * case when p_unit = 'LBS' then 0.45359237 else 1 end;
$$;

grant execute on function public.to_kg(numeric, text) to authenticated;

-- ── RPC signatures change: drop old, recreate with def id ───────
-- (create-or-replace would add an ambiguous overload instead.)
drop function if exists public.create_exercise_with_sets(text, date, text, text, jsonb);
drop function if exists public.update_exercise_with_sets(bigint, text, text, text, jsonb);

create function public.create_exercise_with_sets(
  p_name  text,
  p_date  date,
  p_unit  text,
  p_notes text,
  p_sets  jsonb,   -- [{ "reps": 8, "weight": 60 }, ...]
  p_exercise_def_id bigint default null   -- null = legacy client; no PR flags
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

    insert into public.exercise_sets (exercise_id, set_number, reps, weight)
    values (v_exercise_id, v_idx, v_reps, v_weight);

    v_is_weight_pr := false;
    v_is_e1rm_pr   := false;

    if p_exercise_def_id is not null then
      v_weight_kg := public.to_kg(v_weight, p_unit);

      -- Only a PR if there's at least one prior set to beat. Beating
      -- means more weight, or equal weight with strictly more reps.
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

grant execute on function public.create_exercise_with_sets(text, date, text, text, jsonb, bigint) to authenticated;

create function public.update_exercise_with_sets(
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

      insert into public.exercise_sets (exercise_id, set_number, reps, weight)
      values (p_id, v_idx, v_reps, v_weight);

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

grant execute on function public.update_exercise_with_sets(bigint, text, text, text, jsonb, bigint) to authenticated;

-- ── Live view: id-keyed, kg-normalized ──────────────────────────
-- Output columns unchanged, so create-or-replace is safe and the
-- dependent exercises_with_pr view is unaffected. Unlinked rows
-- (def id null) are excluded: they never hold PRs, and their
-- exercises simply have has_pr = false until the straggler remap.
create or replace view public.exercise_set_pr_flags
with (security_invoker = true) as
with flags as (
  select
    es.id  as set_id,
    es.exercise_id,
    e.user_id,
    e.exercise_def_id,
    public.to_kg(es.weight, e.unit) as weight_kg,
    es.reps,
    count(*) filter (where es.weight is not null) over w as weighted_set_count,
    max(public.to_kg(es.weight, e.unit)) over w as max_weight_kg,
    count(*) filter (where es.weight is not null and es.reps > 1) over w as e1rm_set_count,
    max(public.to_kg(es.weight, e.unit) * (1 + es.reps / 30.0))
      filter (where es.weight is not null and es.reps > 1) over w as max_e1rm_kg
  from public.exercise_sets es
  join public.exercises e on e.id = es.exercise_id
  where e.exercise_def_id is not null
  window w as (partition by e.user_id, e.exercise_def_id)
),
tie as (
  select *,
    max(coalesce(reps, 0)) filter (where weight_kg is not null and weight_kg = max_weight_kg)
      over (partition by user_id, exercise_def_id) as best_reps_at_max_weight
  from flags
)
select
  set_id,
  exercise_id,
  user_id,
  (
    weight_kg is not null
    and weighted_set_count >= 2
    and weight_kg = max_weight_kg
    and coalesce(reps, 0) = best_reps_at_max_weight
  ) as is_weight_pr,
  (
    weight_kg is not null and reps is not null and reps > 1
    and e1rm_set_count >= 2
    and (weight_kg * (1 + reps / 30.0)) = max_e1rm_kg
  ) as is_e1rm_pr
from tie;

-- ── RPC: custom exercise with near-duplicate guard ──────────────
create function public.create_custom_exercise(
  p_name         text,
  p_muscle_group text,
  p_equipment    text,
  p_force        boolean default false
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_name        text := btrim(p_name);
  v_suggestions jsonb;
  v_id          bigint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if v_name = '' then
    raise exception 'name must not be empty';
  end if;

  -- An exact catalog match can never be recreated as a custom, even
  -- with p_force — the catalog entry IS that exercise.
  select jsonb_agg(jsonb_build_object(
           'id', d.id, 'name', d.name, 'muscle_group', d.muscle_group,
           'is_custom', false, 'similarity', 1.0))
    into v_suggestions
  from public.exercise_defs d
  where d.user_id is null and lower(d.name) = lower(v_name);

  if v_suggestions is not null then
    return jsonb_build_object('created', false, 'suggestions', v_suggestions);
  end if;

  if not p_force then
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'name', s.name, 'muscle_group', s.muscle_group,
             'is_custom', s.is_custom, 'similarity', s.sim)
           order by s.sim desc)
      into v_suggestions
    from (
      select d.id, d.name, d.muscle_group,
             d.user_id is not null as is_custom,
             round(extensions.similarity(lower(v_name), lower(d.name))::numeric, 2) as sim
      from public.exercise_defs d
      where (d.user_id is null or d.user_id = auth.uid())
        and extensions.similarity(lower(v_name), lower(d.name)) >= 0.45
      order by extensions.similarity(lower(v_name), lower(d.name)) desc
      limit 5
    ) s;

    if v_suggestions is not null then
      return jsonb_build_object('created', false, 'suggestions', v_suggestions);
    end if;
  end if;

  begin
    insert into public.exercise_defs (user_id, name, muscle_group, equipment)
    values (auth.uid(), v_name, p_muscle_group, p_equipment)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You already have a custom exercise named "%"', v_name;
  end;

  return jsonb_build_object('created', true, 'def', jsonb_build_object(
    'id', v_id, 'name', v_name,
    'muscle_group', p_muscle_group, 'equipment', p_equipment));
end;
$$;

grant execute on function public.create_custom_exercise(text, text, text, boolean) to authenticated;

-- ── RPC: current PR for one exercise def (picker chip) ──────────
create function public.get_exercise_pr(p_exercise_def_id bigint)
returns jsonb
language sql
security invoker
as $$
  select jsonb_build_object(
    'best_weight', (
      select jsonb_build_object('weight', s.weight, 'unit', e.unit, 'reps', s.reps)
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
        'e1rm_kg', round(public.to_kg(s.weight, e.unit) * (1 + s.reps / 30.0), 1))
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
