-- ================================================================
-- Migration 001: server-side validation + notes-clear fix
--
-- Run this once in the Supabase SQL editor against a project where
-- supabase/schema.sql has already been applied. Adds back the
-- non-empty-name and 1-100-sets validation that PostgREST doesn't
-- enforce on its own, and fixes update_exercise_with_sets so
-- clearing an exercise's notes actually persists (previously
-- COALESCE treated "cleared" and "not provided" as the same NULL).
-- ================================================================

-- 1. Non-empty name — additive constraint, combines with the existing
--    length check (both must hold).
alter table public.exercises
  add constraint exercises_name_not_blank check (char_length(btrim(name)) > 0);

-- 2. create_exercise_with_sets — enforce 1-100 sets, store cleared
--    notes ('') as NULL instead of the literal empty string.
create or replace function public.create_exercise_with_sets(
  p_name  text,
  p_date  date,
  p_unit  text,
  p_notes text,
  p_sets  jsonb
) returns bigint
language plpgsql
security invoker
as $$
declare
  v_exercise_id bigint;
  v_set jsonb;
  v_idx  int := 0;
begin
  if p_sets is null or jsonb_array_length(p_sets) < 1 or jsonb_array_length(p_sets) > 100 then
    raise exception 'sets must contain between 1 and 100 entries';
  end if;

  insert into public.exercises (user_id, name, date, unit, notes)
  values (auth.uid(), p_name, p_date, p_unit, nullif(p_notes, ''))
  returning id into v_exercise_id;

  for v_set in select * from jsonb_array_elements(p_sets) loop
    v_idx := v_idx + 1;
    insert into public.exercise_sets (exercise_id, set_number, reps, weight)
    values (
      v_exercise_id,
      v_idx,
      (v_set->>'reps')::int,
      (v_set->>'weight')::numeric
    );
  end loop;

  return v_exercise_id;
end;
$$;

-- 3. update_exercise_with_sets — enforce 1-100 sets when provided, and
--    distinguish "notes not provided" (NULL, leave unchanged) from
--    "notes explicitly cleared" (empty string, store as NULL).
create or replace function public.update_exercise_with_sets(
  p_id    bigint,
  p_name  text default null,
  p_unit  text default null,
  p_notes text default null,
  p_sets  jsonb default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_set jsonb;
  v_idx int := 0;
begin
  if p_sets is not null and (jsonb_array_length(p_sets) < 1 or jsonb_array_length(p_sets) > 100) then
    raise exception 'sets must contain between 1 and 100 entries';
  end if;

  update public.exercises
  set name  = coalesce(p_name,  name),
      unit  = coalesce(p_unit,  unit),
      notes = case when p_notes is null then notes else nullif(p_notes, '') end
  where id = p_id;

  if not found then
    raise exception 'Exercise % not found or not owned by caller', p_id
      using errcode = 'P0002';
  end if;

  if p_sets is not null then
    delete from public.exercise_sets where exercise_id = p_id;

    for v_set in select * from jsonb_array_elements(p_sets) loop
      v_idx := v_idx + 1;
      insert into public.exercise_sets (exercise_id, set_number, reps, weight)
      values (p_id, v_idx, (v_set->>'reps')::int, (v_set->>'weight')::numeric);
    end loop;
  end if;
end;
$$;
