-- ================================================================
-- Migration 008: refresh exercises_with_pr's column list
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-007 have already been applied.
--
-- Bug: exercises_with_pr (migration 003) is `select e.*, has_pr`.
-- Postgres expands `e.*` into an explicit column list AT VIEW
-- CREATION TIME and never revisits it — columns added to the base
-- table afterward do not appear in the view's output until the view
-- is recreated. exercise_def_id (added in 005) and
-- superset_partner_id (added in 007) have therefore never actually
-- been returned by getByDate/fetchExerciseById, even though both
-- columns are written and read correctly server-side. Symptoms:
--   - Editing a saved exercise shows "choose an exercise" instead of
--     the catalog pick that was already made — exercise_def_id came
--     back as undefined, so the picker field looked unset.
--   - A superset link appeared to not save — it did, but reopening
--     the exercise for edit (or reloading the day) never saw
--     superset_partner_id, so the pairing looked gone.
-- (Migration 007's own comment claimed the new column "flows
-- through automatically" — that was wrong; this migration is the
-- correction.)
--
-- Fix: CREATE OR REPLACE VIEW can only APPEND columns at the end of
-- the existing list, and here the two missing columns sit between
-- the original columns and has_pr — so a plain replace would fail.
-- Drop and recreate instead; nothing else references this view.
-- ================================================================

drop view public.exercises_with_pr;

create view public.exercises_with_pr
with (security_invoker = true) as
select
  e.*,
  exists (
    select 1 from public.exercise_set_pr_flags p
    where p.exercise_id = e.id
      and (p.is_weight_pr or p.is_e1rm_pr)
  ) as has_pr
from public.exercises e;

grant select on public.exercises_with_pr to authenticated;
