-- ================================================================
-- History remap — step 2 of 2: apply
--
-- Generated from the report output reviewed and approved on
-- 2026-07-13 (55 distinct names: 50 mapped to catalog entries,
-- 4 converted to custom exercises, 1 synthetic test row deleted).
--
-- Run ONCE in the Supabase SQL editor. Everything runs in a single
-- transaction; a pre-flight assertion aborts the whole script if
-- any def_id no longer matches the catalog name that was reviewed,
-- so a drifted catalog can't silently mislink history.
--
-- Not idempotent by design: a second run would fail on the custom-
-- exercise unique index rather than duplicate anything.
-- ================================================================

begin;

-- ── Reviewed mapping: historical name -> catalog def ────────────
create temp table _remap (
  norm_name             text primary key,
  def_id                bigint not null,
  expected_catalog_name text not null
) on commit drop;

insert into _remap (norm_name, def_id, expected_catalog_name) values
  -- Bucket A: confirmed as top-ranked (33)
  ('bench press',                     1,  'Bench Press'),
  ('cable curls',                     45, 'Cable Curl'),
  ('calf raises',                     94, 'Calf Raise'),
  ('chest flys',                      5,  'Chest Fly'),
  ('chest flys (orange)',             5,  'Chest Fly'),
  ('close grip bench',                55, 'Close-Grip Bench Press'),
  ('face pulls',                      35, 'Face Pull'),
  ('hack squat',                      71, 'Hack Squat'),
  ('hamer curls',                     42, 'Hammer Curl'),
  ('hammer curls',                    42, 'Hammer Curl'),
  ('incline bench',                   2,  'Incline Bench Press'),
  ('incline bench press',             2,  'Incline Bench Press'),
  ('incline dumbbell press',          4,  'Incline Dumbbell Press'),
  ('lateral raise',                   31, 'Lateral Raise'),
  ('lateral raises',                  31, 'Lateral Raise'),
  ('leg extension',                   68, 'Leg Extension'),
  ('leg extensions',                  68, 'Leg Extension'),
  ('machine row',                     23, 'Machine Row'),
  ('machine rows',                    23, 'Machine Row'),
  ('machine shoulder press',          36, 'Machine Shoulder Press'),
  ('neutral grip pull ups',           27, 'Neutral-Grip Pull-Ups'),
  ('preacher curls',                  43, 'Preacher Curl'),
  ('preachers curls',                 43, 'Preacher Curl'),
  ('pull ups',                        14, 'Pull-Ups'),
  ('pull-ups',                        14, 'Pull-Ups'),
  ('pulls ups',                       14, 'Pull-Ups'),
  ('rear delt',                       33, 'Rear Delt Fly'),
  ('rear delta',                      33, 'Rear Delt Fly'),
  ('shoulder machine press',          36, 'Machine Shoulder Press'),
  ('squats',                          66, 'Squat'),
  ('tricep push down',                51, 'Tricep Pushdown'),
  ('tricep push downs',               51, 'Tricep Pushdown'),
  ('tricep rope push down',           51, 'Tricep Pushdown'),
  -- Bucket B: reviewed overrides of the trigram suggestion (16)
  ('calf extension',                  94, 'Calf Raise'),
  ('close grip t bar row',            19, 'T-Bar Row'),
  ('dumbbell flys',                   5,  'Chest Fly'),
  ('hamer rope curl',                 50, 'Cable Hammer Curl'),
  ('hamstring curls',                 79, 'Leg Curl'),
  ('incline dumbbell',                4,  'Incline Dumbbell Press'),
  ('incline dumbbell bench',          4,  'Incline Dumbbell Press'),
  ('machine bench press',             10, 'Machine Chest Press'),
  ('machine flus',                    11, 'Pec Deck'),
  ('machine fly',                     11, 'Pec Deck'),
  ('machine flys',                    11, 'Pec Deck'),
  ('reverse flys',                    33, 'Rear Delt Fly'),
  ('rope extensions',                 54, 'Cable Overhead Extension'),
  ('rope push down',                  51, 'Tricep Pushdown'),
  ('shrugs',                          24, 'Barbell Shrug'),
  ('wide grip pull ups',              14, 'Pull-Ups'),
  -- Bucket C: mapped per approval (1)
  ('tricep extension (strange grip)', 60, 'Machine Tricep Extension');

-- ── Pre-flight: abort if any def_id doesn't match what was reviewed
do $$
declare
  v_bad text;
begin
  select string_agg(m.norm_name || ' -> id ' || m.def_id, ', ')
    into v_bad
  from _remap m
  left join public.exercise_defs d
    on d.id = m.def_id and d.user_id is null and d.name = m.expected_catalog_name
  where d.id is null;

  if v_bad is not null then
    raise exception 'catalog mismatch, nothing applied: %', v_bad;
  end if;
end;
$$;

-- ── Link mapped history (50 names) ──────────────────────────────
update public.exercises e
set exercise_def_id = m.def_id
from _remap m
where e.user_id = '82b437c2-f7c9-42e2-92ab-95bbd7802215'::uuid
  and e.exercise_def_id is null
  and lower(btrim(e.name)) = m.norm_name;

-- ── Bucket C: custom exercises (4) ──────────────────────────────
with new_def as (
  insert into public.exercise_defs (user_id, name, muscle_group, equipment)
  values ('82b437c2-f7c9-42e2-92ab-95bbd7802215'::uuid, 'EZ Bar Superset', 'BICEPS', 'BARBELL')
  returning id
)
update public.exercises e
set exercise_def_id = (select id from new_def)
where e.user_id = '82b437c2-f7c9-42e2-92ab-95bbd7802215'::uuid
  and e.exercise_def_id is null
  and lower(btrim(e.name)) = 'ez bar superset';

with new_def as (
  insert into public.exercise_defs (user_id, name, muscle_group, equipment)
  values ('82b437c2-f7c9-42e2-92ab-95bbd7802215'::uuid, 'Machine Lateral Raise', 'SHOULDERS', 'MACHINE')
  returning id
)
update public.exercises e
set exercise_def_id = (select id from new_def)
where e.user_id = '82b437c2-f7c9-42e2-92ab-95bbd7802215'::uuid
  and e.exercise_def_id is null
  and lower(btrim(e.name)) = 'machine lateral raise';

with new_def as (
  insert into public.exercise_defs (user_id, name, muscle_group, equipment)
  values ('82b437c2-f7c9-42e2-92ab-95bbd7802215'::uuid, 'Rows', 'BACK', 'OTHER')
  returning id
)
update public.exercises e
set exercise_def_id = (select id from new_def)
where e.user_id = '82b437c2-f7c9-42e2-92ab-95bbd7802215'::uuid
  and e.exercise_def_id is null
  and lower(btrim(e.name)) = 'rows';

with new_def as (
  insert into public.exercise_defs (user_id, name, muscle_group, equipment)
  values ('82b437c2-f7c9-42e2-92ab-95bbd7802215'::uuid, 'Wide Grip Rows', 'BACK', 'CABLE')
  returning id
)
update public.exercises e
set exercise_def_id = (select id from new_def)
where e.user_id = '82b437c2-f7c9-42e2-92ab-95bbd7802215'::uuid
  and e.exercise_def_id is null
  and lower(btrim(e.name)) = 'wide grip rows';

-- ── Delete the synthetic test entry (sets cascade) ──────────────
delete from public.exercises
where user_id = '82b437c2-f7c9-42e2-92ab-95bbd7802215'::uuid
  and lower(btrim(name)) = 'zzz reps test';

commit;

-- ── Verify ──────────────────────────────────────────────────────
-- Expect 0:
select count(*) as unlinked from public.exercises where exercise_def_id is null;
-- Expect the 4 customs:
select id, name, muscle_group, equipment from public.exercise_defs
where user_id is not null order by name;
