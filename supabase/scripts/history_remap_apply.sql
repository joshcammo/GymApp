-- ================================================================
-- History remap — step 2 of 2: apply (idempotent)
--
-- Generated from the report output reviewed and approved on
-- 2026-07-13 (55 distinct names: 50 mapped to catalog entries,
-- 4 converted to custom exercises, 1 synthetic test row deleted).
--
-- Safe to run repeatedly — every step completes only what's still
-- missing. This matters because the v1 script's failure on the SQL
-- editor's pooled backend was NOT clean: statements that didn't
-- reference the temp table (the custom inserts and the test-row
-- delete) executed and committed even though the mapping updates
-- never ran. This version converges any such partial state:
--   - catalog links only touch rows where exercise_def_id is null
--   - customs are looked up first and only inserted if absent
--   - the delete is a no-op once the row is gone
--
-- Single DO block: one statement, one session, atomic per run.
-- The pre-flight assertion still aborts the run if any def_id no
-- longer matches the catalog name that was reviewed.
-- ================================================================

do $$
declare
  v_user   constant uuid := '82b437c2-f7c9-42e2-92ab-95bbd7802215';
  v_bad    text;
  v_def_id bigint;
  v_linked int;
begin
  -- ── Reviewed mapping: historical name -> catalog def ──────────
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
  select string_agg(m.norm_name || ' -> id ' || m.def_id, ', ')
    into v_bad
  from _remap m
  left join public.exercise_defs d
    on d.id = m.def_id and d.user_id is null and d.name = m.expected_catalog_name
  where d.id is null;

  if v_bad is not null then
    raise exception 'catalog mismatch, nothing applied: %', v_bad;
  end if;

  -- ── Link mapped history (50 names; only still-unlinked rows) ──
  update public.exercises e
  set exercise_def_id = m.def_id
  from _remap m
  where e.user_id = v_user
    and e.exercise_def_id is null
    and lower(btrim(e.name)) = m.norm_name;
  get diagnostics v_linked = row_count;
  raise notice 'catalog links applied: % exercise rows', v_linked;

  -- ── Bucket C: custom exercises (create only if absent) ────────
  select id into v_def_id from public.exercise_defs
  where user_id = v_user and lower(name) = 'ez bar superset';
  if v_def_id is null then
    insert into public.exercise_defs (user_id, name, muscle_group, equipment)
    values (v_user, 'EZ Bar Superset', 'BICEPS', 'BARBELL')
    returning id into v_def_id;
  end if;
  update public.exercises set exercise_def_id = v_def_id
  where user_id = v_user and exercise_def_id is null
    and lower(btrim(name)) = 'ez bar superset';

  select id into v_def_id from public.exercise_defs
  where user_id = v_user and lower(name) = 'machine lateral raise';
  if v_def_id is null then
    insert into public.exercise_defs (user_id, name, muscle_group, equipment)
    values (v_user, 'Machine Lateral Raise', 'SHOULDERS', 'MACHINE')
    returning id into v_def_id;
  end if;
  update public.exercises set exercise_def_id = v_def_id
  where user_id = v_user and exercise_def_id is null
    and lower(btrim(name)) = 'machine lateral raise';

  select id into v_def_id from public.exercise_defs
  where user_id = v_user and lower(name) = 'rows';
  if v_def_id is null then
    insert into public.exercise_defs (user_id, name, muscle_group, equipment)
    values (v_user, 'Rows', 'BACK', 'OTHER')
    returning id into v_def_id;
  end if;
  update public.exercises set exercise_def_id = v_def_id
  where user_id = v_user and exercise_def_id is null
    and lower(btrim(name)) = 'rows';

  select id into v_def_id from public.exercise_defs
  where user_id = v_user and lower(name) = 'wide grip rows';
  if v_def_id is null then
    insert into public.exercise_defs (user_id, name, muscle_group, equipment)
    values (v_user, 'Wide Grip Rows', 'BACK', 'CABLE')
    returning id into v_def_id;
  end if;
  update public.exercises set exercise_def_id = v_def_id
  where user_id = v_user and exercise_def_id is null
    and lower(btrim(name)) = 'wide grip rows';

  -- ── Delete the synthetic test entry (no-op once gone) ─────────
  delete from public.exercises
  where user_id = v_user
    and lower(btrim(name)) = 'zzz reps test';

  -- ── Summary ───────────────────────────────────────────────────
  select count(*) into v_linked from public.exercises where exercise_def_id is null;
  raise notice 'unlinked exercise rows remaining (expect 0): %', v_linked;
end;
$$;

-- ── Verify ──────────────────────────────────────────────────────
-- Expect 0:
select count(*) as unlinked from public.exercises where exercise_def_id is null;
-- Expect the 4 customs:
select id, name, muscle_group, equipment from public.exercise_defs
where user_id is not null order by name;
