-- ================================================================
-- Migration 018: cardio sessions
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-017 have already been applied.
--
-- Adds manual cardio logging (run/bike/walk/hike/swim/other) as a
-- sibling to strength workouts (public.exercises). Mirrors that
-- table's shape and RLS/RPC pattern.
--
-- source/external_id are included now, ahead of the Strava/Garmin
-- integrations planned next, so those features can land without a
-- breaking migration: imported sessions will set source to the
-- provider and external_id to the provider's activity id, and the
-- partial unique index below prevents importing the same activity
-- twice. Manually-logged sessions (source = 'manual', the only kind
-- that exists today) are unaffected by that constraint.
-- ================================================================

create table public.cardio_sessions (
  id               bigint generated always as identity primary key,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  activity_type    text        not null check (activity_type in ('run', 'bike', 'walk', 'hike', 'swim', 'other')),
  date             date        not null,
  duration_seconds int         not null check (duration_seconds > 0 and duration_seconds <= 86400),
  distance_meters  numeric(10,2) check (distance_meters is null or distance_meters >= 0),
  notes            text        check (notes is null or char_length(notes) <= 500),
  source           text        not null default 'manual' check (source in ('manual', 'strava', 'garmin', 'apple_health')),
  external_id      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One row per (user, provider, provider activity id) — de-dupes future imports.
-- Manual entries (source = 'manual') are exempt since they have no external_id.
create unique index uq_cardio_sessions_source_external
  on public.cardio_sessions (user_id, source, external_id)
  where source <> 'manual';

create index idx_cardio_sessions_user_date on public.cardio_sessions (user_id, date);

create trigger trg_cardio_sessions_updated_at
before update on public.cardio_sessions
for each row execute function public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────
alter table public.cardio_sessions enable row level security;

create policy cardio_sessions_select_own on public.cardio_sessions
  for select using (auth.uid() = user_id);
create policy cardio_sessions_insert_own on public.cardio_sessions
  for insert with check (auth.uid() = user_id);
create policy cardio_sessions_update_own on public.cardio_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy cardio_sessions_delete_own on public.cardio_sessions
  for delete using (auth.uid() = user_id);

-- ── RPC: create a manually-logged cardio session ────────────
create function public.create_cardio_session(
  p_activity_type    text,
  p_date             date,
  p_duration_seconds int,
  p_distance_meters  numeric default null,
  p_notes            text default null
) returns bigint
language plpgsql
security invoker
as $$
declare
  v_id bigint;
begin
  insert into public.cardio_sessions (user_id, activity_type, date, duration_seconds, distance_meters, notes)
  values (auth.uid(), p_activity_type, p_date, p_duration_seconds, p_distance_meters, nullif(p_notes, ''))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_cardio_session(text, date, int, numeric, text) to authenticated;

-- ── RPC: partially update a cardio session (COALESCE, like update_exercise_with_sets) ─
create function public.update_cardio_session(
  p_id                bigint,
  p_activity_type     text default null,
  p_duration_seconds  int default null,
  p_distance_meters   numeric default null,
  p_distance_provided boolean default false,
  p_notes             text default null
) returns void
language plpgsql
security invoker
as $$
begin
  update public.cardio_sessions
  set activity_type    = coalesce(p_activity_type, activity_type),
      duration_seconds = coalesce(p_duration_seconds, duration_seconds),
      -- p_distance_provided distinguishes "field not sent" from "field cleared to null",
      -- since coalesce(null, ...) can't tell those apart for a nullable column.
      distance_meters  = case when p_distance_provided then p_distance_meters else distance_meters end,
      -- p_notes = null means "not provided, leave unchanged"; p_notes = '' means
      -- "explicitly cleared" and is stored as null (same convention as exercises.notes).
      notes            = case when p_notes is null then notes else nullif(p_notes, '') end
  where id = p_id and user_id = auth.uid();

  if not found then
    raise exception 'Cardio session % not found or not owned by caller', p_id
      using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.update_cardio_session(bigint, text, int, numeric, boolean, text) to authenticated;
