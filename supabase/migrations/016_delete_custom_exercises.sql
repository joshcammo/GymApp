-- ================================================================
-- Migration 016: allow deleting custom exercises
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-015 have already been applied.
--
-- exercise_defs already has a delete_own RLS policy (migration 005),
-- but both FKs into it were plain (no ON DELETE clause), so deleting
-- a custom exercise ever logged or saved in a preset would fail with
-- a foreign-key violation. This migration relaxes those FKs so the
-- picker can offer a real delete:
--   - exercises.exercise_def_id -> SET NULL. exercises.name is
--     already a display snapshot (see migration 005), so past log
--     entries keep showing correctly; they just stop counting toward
--     PRs for a def that no longer exists.
--   - preset_exercises.exercise_def_id -> CASCADE (it's NOT NULL, so
--     SET NULL isn't an option). Deleting a custom exercise quietly
--     drops it from any saved presets that included it.
-- No catalog (user_id is null) row is ever deletable — RLS still
-- scopes delete_own to user_id = auth.uid().
-- ================================================================

alter table public.exercises
  drop constraint exercises_exercise_def_id_fkey,
  add constraint exercises_exercise_def_id_fkey
    foreign key (exercise_def_id) references public.exercise_defs(id) on delete set null;

alter table public.preset_exercises
  drop constraint preset_exercises_exercise_def_id_fkey,
  add constraint preset_exercises_exercise_def_id_fkey
    foreign key (exercise_def_id) references public.exercise_defs(id) on delete cascade;
