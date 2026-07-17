-- ================================================================
-- Migration 009: exercise presets
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-008 have already been applied.
--
-- Lets a user save a named group of catalog/custom exercises (e.g.
-- "Monday - Chest and Triceps") and apply it to a day in one tap.
-- Applying a preset creates one exercises row per preset item, in
-- the preset's saved order, each starting with a single empty set —
-- identical starting state to tapping "Add Exercise" and saving with
-- nothing filled in yet, so the user still logs their own reps/
-- weight for the day. Applying always appends; it does not check
-- for or skip exercises already logged that day, same as adding
-- exercises manually one at a time.
-- ================================================================

create table public.presets (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null check (char_length(btrim(name)) > 0 and char_length(name) <= 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_presets_user_name on public.presets (user_id, lower(name));

create trigger trg_presets_updated_at
before update on public.presets
for each row execute function public.set_updated_at();

create table public.preset_exercises (
  id              bigint generated always as identity primary key,
  preset_id       bigint not null references public.presets(id) on delete cascade,
  exercise_def_id bigint not null references public.exercise_defs(id),
  position        int    not null check (position > 0),
  unique (preset_id, position)
);

create index idx_preset_exercises_preset on public.preset_exercises (preset_id);

-- ── Row Level Security ─────────────────────────────────────
alter table public.presets          enable row level security;
alter table public.preset_exercises enable row level security;

create policy presets_select_own on public.presets
  for select using (auth.uid() = user_id);
create policy presets_insert_own on public.presets
  for insert with check (auth.uid() = user_id);
create policy presets_update_own on public.presets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy presets_delete_own on public.presets
  for delete using (auth.uid() = user_id);

create policy preset_exercises_select_own on public.preset_exercises
  for select using (
    exists (select 1 from public.presets p
            where p.id = preset_exercises.preset_id and p.user_id = auth.uid())
  );
create policy preset_exercises_insert_own on public.preset_exercises
  for insert with check (
    exists (select 1 from public.presets p
            where p.id = preset_exercises.preset_id and p.user_id = auth.uid())
  );
create policy preset_exercises_update_own on public.preset_exercises
  for update using (
    exists (select 1 from public.presets p
            where p.id = preset_exercises.preset_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.presets p
            where p.id = preset_exercises.preset_id and p.user_id = auth.uid())
  );
create policy preset_exercises_delete_own on public.preset_exercises
  for delete using (
    exists (select 1 from public.presets p
            where p.id = preset_exercises.preset_id and p.user_id = auth.uid())
  );

-- ── RPC: create a preset with its ordered exercises ─────────────
create function public.create_preset(
  p_name             text,
  p_exercise_def_ids bigint[]
) returns bigint
language plpgsql
security invoker
as $$
declare
  v_preset_id bigint;
  v_def_id    bigint;
  v_idx       int := 0;
begin
  if p_exercise_def_ids is null or array_length(p_exercise_def_ids, 1) is null then
    raise exception 'a preset needs at least one exercise';
  end if;

  begin
    insert into public.presets (user_id, name)
    values (auth.uid(), p_name)
    returning id into v_preset_id;
  exception when unique_violation then
    raise exception 'You already have a preset named "%"', p_name;
  end;

  foreach v_def_id in array p_exercise_def_ids loop
    v_idx := v_idx + 1;
    if not exists (
      select 1 from public.exercise_defs d
      where d.id = v_def_id and (d.user_id is null or d.user_id = auth.uid())
    ) then
      raise exception 'Exercise definition % not found or not accessible', v_def_id
        using errcode = 'P0002';
    end if;
    insert into public.preset_exercises (preset_id, exercise_def_id, position)
    values (v_preset_id, v_def_id, v_idx);
  end loop;

  return v_preset_id;
end;
$$;

grant execute on function public.create_preset(text, bigint[]) to authenticated;

-- ── RPC: rename a preset and replace its exercise list ──────────
create function public.update_preset(
  p_id               bigint,
  p_name             text,
  p_exercise_def_ids bigint[]
) returns void
language plpgsql
security invoker
as $$
declare
  v_def_id bigint;
  v_idx    int := 0;
begin
  if p_exercise_def_ids is null or array_length(p_exercise_def_ids, 1) is null then
    raise exception 'a preset needs at least one exercise';
  end if;

  begin
    update public.presets
    set name = p_name
    where id = p_id and user_id = auth.uid();
  exception when unique_violation then
    raise exception 'You already have a preset named "%"', p_name;
  end;

  if not found then
    raise exception 'Preset % not found or not owned by caller', p_id
      using errcode = 'P0002';
  end if;

  delete from public.preset_exercises where preset_id = p_id;

  foreach v_def_id in array p_exercise_def_ids loop
    v_idx := v_idx + 1;
    if not exists (
      select 1 from public.exercise_defs d
      where d.id = v_def_id and (d.user_id is null or d.user_id = auth.uid())
    ) then
      raise exception 'Exercise definition % not found or not accessible', v_def_id
        using errcode = 'P0002';
    end if;
    insert into public.preset_exercises (preset_id, exercise_def_id, position)
    values (p_id, v_def_id, v_idx);
  end loop;
end;
$$;

grant execute on function public.update_preset(bigint, text, bigint[]) to authenticated;

-- ── RPC: apply a preset to a day ─────────────────────────────────
create function public.apply_preset_to_day(
  p_preset_id bigint,
  p_date      date
) returns bigint[]
language plpgsql
security invoker
as $$
declare
  v_item        record;
  v_exercise_id bigint;
  v_result      bigint[] := '{}';
begin
  if not exists (
    select 1 from public.presets where id = p_preset_id and user_id = auth.uid()
  ) then
    raise exception 'Preset % not found or not owned by caller', p_preset_id
      using errcode = 'P0002';
  end if;

  for v_item in
    select pe.exercise_def_id, d.name
    from public.preset_exercises pe
    join public.exercise_defs d on d.id = pe.exercise_def_id
    where pe.preset_id = p_preset_id
    order by pe.position asc
  loop
    insert into public.exercises (user_id, name, date, unit, exercise_def_id)
    values (auth.uid(), v_item.name, p_date, 'KG', v_item.exercise_def_id)
    returning id into v_exercise_id;

    insert into public.exercise_sets (exercise_id, set_number, reps, weight)
    values (v_exercise_id, 1, null, null);

    v_result := array_append(v_result, v_exercise_id);
  end loop;

  return v_result;
end;
$$;

grant execute on function public.apply_preset_to_day(bigint, date) to authenticated;

-- ── View: presets with their ordered exercises (listing/edit UI) ─
create view public.presets_with_exercises
with (security_invoker = true) as
select
  p.id, p.user_id, p.name, p.created_at, p.updated_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'exercise_def_id', pe.exercise_def_id,
        'name',            d.name,
        'image_key',       d.image_key,
        'position',        pe.position
      ) order by pe.position asc
    ) filter (where pe.id is not null),
    '[]'::jsonb
  ) as exercises
from public.presets p
left join public.preset_exercises pe on pe.preset_id = p.id
left join public.exercise_defs d on d.id = pe.exercise_def_id
group by p.id;

grant select on public.presets_with_exercises to authenticated;
