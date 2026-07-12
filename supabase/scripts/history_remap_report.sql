-- ================================================================
-- History remap — step 1 of 2: the report
--
-- Matches every distinct historical exercise name (all users) that
-- is not yet linked to the catalog against the seeded exercise_defs
-- rows, using trigram similarity. Read-only — changes nothing.
--
-- Run in the Supabase SQL editor (requires migration 005 applied)
-- and paste the full output back for review. Each name shows its
-- top 3 catalog candidates, confidence-bucketed:
--
--   HIGH      similarity >= 0.75  — likely the same exercise
--   REVIEW    similarity >= 0.40  — plausible, judge by eye
--   NO_MATCH  similarity <  0.40  — probably a genuine custom
--
-- Nothing is auto-merged at any confidence. Every row is confirmed
-- or rejected by hand before the apply script (step 2) is written;
-- near-matches can be genuinely different exercises.
--
-- The exercise_def_id IS NULL filter makes this idempotent — safe
-- to re-run later to catch stragglers logged after the first pass.
-- ================================================================

with hist as (
  select
    e.user_id,
    lower(btrim(e.name)) as norm_name,
    min(e.name)          as sample_name,   -- one spelling for display
    count(*)             as log_entries,
    min(e.date)          as first_logged,
    max(e.date)          as last_logged
  from public.exercises e
  where e.exercise_def_id is null
  group by e.user_id, lower(btrim(e.name))
),
ranked as (
  select
    h.*,
    d.id   as def_id,
    d.name as catalog_name,
    d.muscle_group,
    extensions.similarity(h.norm_name, lower(d.name)) as sim,
    row_number() over (
      partition by h.user_id, h.norm_name
      order by extensions.similarity(h.norm_name, lower(d.name)) desc, d.name
    ) as candidate_rank
  from hist h
  cross join public.exercise_defs d
  where d.user_id is null
)
select
  u.email          as user_email,
  r.user_id,
  r.sample_name    as historical_name,
  r.log_entries,
  r.first_logged,
  r.last_logged,
  r.candidate_rank,
  r.catalog_name   as suggested_catalog_exercise,
  r.def_id,
  r.muscle_group,
  round(r.sim::numeric, 2) as similarity,
  case
    when r.sim >= 0.75 then 'HIGH'
    when r.sim >= 0.40 then 'REVIEW'
    else 'NO_MATCH'
  end as confidence
from ranked r
join auth.users u on u.id = r.user_id
where r.candidate_rank <= 3
order by u.email, r.sample_name, r.candidate_rank;
