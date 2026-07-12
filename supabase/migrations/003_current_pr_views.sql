-- ================================================================
-- Migration 003: persistent "current PR" indicators
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001 and 002 have already been applied.
--
-- Adds two read-only views that compute, live, whether a set is
-- currently the record holder for its exercise (matched by user_id +
-- case/whitespace-insensitive name, same as migration 002) — not a
-- flag stored at insert time, so it never goes stale when a bigger
-- lift is logged later.
--
-- A set only counts as a current record if there is at least one
-- OTHER set for that exercise to compare against (a lone set is not
-- trivially "the max of one value") — same rule as the save-time PR
-- badge in migration 002. Ties: sets sharing the exact max weight
-- (or e1RM) are ALL marked, per the literal "equals the max" definition.
--
-- Both views use `security_invoker = true` (Postgres 15+) so the
-- existing RLS policies on exercises/exercise_sets apply based on
-- the querying user, same as the RPC functions' `security invoker`.
-- ================================================================

-- ── Per-set flags ───────────────────────────────────────────────
create view public.exercise_set_pr_flags
with (security_invoker = true) as
select
  es.id          as set_id,
  es.exercise_id,
  e.user_id,
  (
    es.weight is not null
    and count(*) filter (where es.weight is not null)
        over (partition by e.user_id, lower(btrim(e.name))) >= 2
    and es.weight = max(es.weight) filter (where es.weight is not null)
        over (partition by e.user_id, lower(btrim(e.name)))
  ) as is_weight_pr,
  (
    es.weight is not null and es.reps is not null and es.reps > 1
    and count(*) filter (where es.weight is not null and es.reps > 1)
        over (partition by e.user_id, lower(btrim(e.name))) >= 2
    and (es.weight * (1 + es.reps / 30.0))
        = max(es.weight * (1 + es.reps / 30.0)) filter (where es.weight is not null and es.reps > 1)
          over (partition by e.user_id, lower(btrim(e.name)))
  ) as is_e1rm_pr
from public.exercise_sets es
join public.exercises e on e.id = es.exercise_id;

grant select on public.exercise_set_pr_flags to authenticated;

-- ── Per-exercise rollup (day view only needs "does this entry have
--    a record-holding set", not which one) ─────────────────────
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
