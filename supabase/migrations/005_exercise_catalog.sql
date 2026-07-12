-- ================================================================
-- Migration 005: exercise catalog (schema + seed)
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-004 have already been applied.
--
-- Adds `exercise_defs`: one table holding both the global exercise
-- catalog (user_id NULL, seeded below, read-only from the client)
-- and per-user custom exercises (user_id set, created via a future
-- RPC). Exercise identity for PR purposes will key off this table's
-- id — retiring lower(btrim(name)) matching — in a later migration;
-- this one is purely additive and changes no behavior.
--
-- Also adds the nullable `exercises.exercise_def_id` FK (backfilled
-- by the history-remap step before the identity switch) and the
-- pg_trgm groundwork for the custom-exercise near-duplicate guard.
--
-- Seed: 112 global exercises across 11 muscle groups (incl. CORE).
-- The 48 names already in the app's client-side picker are kept
-- verbatim so their bundled illustrations keep working; image_key
-- slugs for the 64 new entries have art coming with the picker PR.
-- ================================================================

-- Trigram similarity, used by the upcoming custom-exercise
-- near-duplicate guard. Supabase convention: extensions schema.
create extension if not exists pg_trgm with schema extensions;

-- ── exercise_defs ───────────────────────────────────────────────
create table public.exercise_defs (
  id                bigint generated always as identity primary key,
  -- NULL = global catalog row; set = one user's custom exercise
  user_id           uuid references auth.users(id) on delete cascade,
  name              text not null
                      check (char_length(btrim(name)) > 0 and char_length(name) <= 255),
  muscle_group      text not null check (muscle_group in (
                      'CHEST','BACK','SHOULDERS','BICEPS','TRICEPS','FOREARMS',
                      'QUADS','HAMSTRINGS','GLUTES','CALVES','CORE')),
  secondary_muscles text[] not null default '{}'
                      check (secondary_muscles <@ array[
                      'CHEST','BACK','SHOULDERS','BICEPS','TRICEPS','FOREARMS',
                      'QUADS','HAMSTRINGS','GLUTES','CALVES','CORE']::text[]),
  equipment         text not null check (equipment in (
                      'BARBELL','DUMBBELL','MACHINE','CABLE','BODYWEIGHT',
                      'KETTLEBELL','BAND','OTHER')),
  movement_pattern  text check (movement_pattern is null or movement_pattern in (
                      'PUSH','PULL','HINGE','SQUAT','LUNGE','CARRY',
                      'ROTATION','CORE_BRACE','ISOLATION')),
  -- Maps to a bundled illustration asset in the app; NULL falls back
  -- to a muscle-group placeholder tile.
  image_key         text,
  created_at        timestamptz not null default now()
);

-- Catalog names globally unique; custom names unique per user.
create unique index uq_exercise_defs_global_name
  on public.exercise_defs (lower(name)) where user_id is null;
create unique index uq_exercise_defs_user_name
  on public.exercise_defs (user_id, lower(name)) where user_id is not null;

-- Near-duplicate lookups for the custom-exercise guard.
create index idx_exercise_defs_name_trgm
  on public.exercise_defs using gin (lower(name) extensions.gin_trgm_ops);

alter table public.exercise_defs enable row level security;

create policy exercise_defs_select on public.exercise_defs
  for select using (user_id is null or user_id = auth.uid());
create policy exercise_defs_insert_own on public.exercise_defs
  for insert with check (user_id = auth.uid());
create policy exercise_defs_update_own on public.exercise_defs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy exercise_defs_delete_own on public.exercise_defs
  for delete using (user_id = auth.uid());

-- ── Link column on the log table ────────────────────────────────
-- Nullable until the history remap backfills it; the picker PR then
-- always sets it for new logs. `name` stays as a display snapshot.
alter table public.exercises
  add column exercise_def_id bigint references public.exercise_defs(id);

create index idx_exercises_user_def on public.exercises (user_id, exercise_def_id);

-- ── Seed: global catalog (112 exercises) ────────────────────────
insert into public.exercise_defs
  (name, muscle_group, secondary_muscles, equipment, movement_pattern, image_key)
values
  -- Chest (12)
  ('Bench Press',            'CHEST', '{SHOULDERS,TRICEPS}',      'BARBELL',    'PUSH',      'bench-press'),
  ('Incline Bench Press',    'CHEST', '{SHOULDERS,TRICEPS}',      'BARBELL',    'PUSH',      'incline-bench-press'),
  ('Dumbbell Bench Press',   'CHEST', '{SHOULDERS,TRICEPS}',      'DUMBBELL',   'PUSH',      'dumbbell-bench-press'),
  ('Incline Dumbbell Press', 'CHEST', '{SHOULDERS,TRICEPS}',      'DUMBBELL',   'PUSH',      'incline-dumbbell-press'),
  ('Chest Fly',              'CHEST', '{SHOULDERS}',              'DUMBBELL',   'ISOLATION', 'chest-fly'),
  ('Cable Crossover',        'CHEST', '{SHOULDERS}',              'CABLE',      'ISOLATION', 'cable-crossover'),
  ('Push-Ups',               'CHEST', '{SHOULDERS,TRICEPS,CORE}', 'BODYWEIGHT', 'PUSH',      'push-ups'),
  ('Dips',                   'CHEST', '{TRICEPS,SHOULDERS}',      'BODYWEIGHT', 'PUSH',      'dips'),
  ('Decline Bench Press',    'CHEST', '{TRICEPS}',                'BARBELL',    'PUSH',      'decline-bench-press'),
  ('Machine Chest Press',    'CHEST', '{SHOULDERS,TRICEPS}',      'MACHINE',    'PUSH',      'machine-chest-press'),
  ('Pec Deck',               'CHEST', '{}',                       'MACHINE',    'ISOLATION', 'pec-deck'),
  ('Incline Cable Fly',      'CHEST', '{SHOULDERS}',              'CABLE',      'ISOLATION', 'incline-cable-fly'),

  -- Back (14)
  ('Deadlift',              'BACK', '{HAMSTRINGS,GLUTES,FOREARMS}', 'BARBELL',    'HINGE',     'deadlift'),
  ('Pull-Ups',              'BACK', '{BICEPS,FOREARMS}',            'BODYWEIGHT', 'PULL',      'pull-ups'),
  ('Lat Pulldown',          'BACK', '{BICEPS}',                     'CABLE',      'PULL',      'lat-pulldown'),
  ('Barbell Row',           'BACK', '{BICEPS,FOREARMS}',            'BARBELL',    'PULL',      'barbell-row'),
  ('Seated Cable Row',      'BACK', '{BICEPS}',                     'CABLE',      'PULL',      'seated-cable-row'),
  ('Dumbbell Row',          'BACK', '{BICEPS,FOREARMS}',            'DUMBBELL',   'PULL',      'dumbbell-row'),
  ('T-Bar Row',             'BACK', '{BICEPS}',                     'BARBELL',    'PULL',      't-bar-row'),
  ('Back Extension',        'BACK', '{GLUTES,HAMSTRINGS}',          'BODYWEIGHT', 'HINGE',     'back-extension'),
  ('Straight-Arm Pulldown', 'BACK', '{TRICEPS}',                    'CABLE',      'ISOLATION', 'straight-arm-pulldown'),
  ('Chest-Supported Row',   'BACK', '{BICEPS}',                     'MACHINE',    'PULL',      'chest-supported-row'),
  ('Machine Row',           'BACK', '{BICEPS}',                     'MACHINE',    'PULL',      'machine-row'),
  ('Barbell Shrug',         'BACK', '{FOREARMS}',                   'BARBELL',    'ISOLATION', 'barbell-shrug'),
  ('Rack Pull',             'BACK', '{HAMSTRINGS,GLUTES,FOREARMS}', 'BARBELL',    'HINGE',     'rack-pull'),
  ('Inverted Row',          'BACK', '{BICEPS,CORE}',                'BODYWEIGHT', 'PULL',      'inverted-row'),

  -- Shoulders (12)
  ('Overhead Press',          'SHOULDERS', '{TRICEPS,CORE}',       'BARBELL',  'PUSH',      'overhead-press'),
  ('Dumbbell Shoulder Press', 'SHOULDERS', '{TRICEPS}',            'DUMBBELL', 'PUSH',      'dumbbell-shoulder-press'),
  ('Arnold Press',            'SHOULDERS', '{TRICEPS}',            'DUMBBELL', 'PUSH',      'arnold-press'),
  ('Lateral Raise',           'SHOULDERS', '{}',                   'DUMBBELL', 'ISOLATION', 'lateral-raise'),
  ('Front Raise',             'SHOULDERS', '{}',                   'DUMBBELL', 'ISOLATION', 'front-raise'),
  ('Rear Delt Fly',           'SHOULDERS', '{BACK}',               'DUMBBELL', 'ISOLATION', 'rear-delt-fly'),
  ('Upright Row',             'SHOULDERS', '{BICEPS,BACK}',        'BARBELL',  'PULL',      'upright-row'),
  ('Face Pull',               'SHOULDERS', '{BACK}',               'CABLE',    'PULL',      'face-pull'),
  ('Machine Shoulder Press',  'SHOULDERS', '{TRICEPS}',            'MACHINE',  'PUSH',      'machine-shoulder-press'),
  ('Cable Lateral Raise',     'SHOULDERS', '{}',                   'CABLE',    'ISOLATION', 'cable-lateral-raise'),
  ('Push Press',              'SHOULDERS', '{TRICEPS,QUADS,CORE}', 'BARBELL',  'PUSH',      'push-press'),
  ('Reverse Pec Deck',        'SHOULDERS', '{BACK}',               'MACHINE',  'ISOLATION', 'reverse-pec-deck'),

  -- Biceps (10)
  ('Barbell Curl',          'BICEPS', '{FOREARMS}',      'BARBELL',    'ISOLATION', 'barbell-curl'),
  ('Dumbbell Curl',         'BICEPS', '{FOREARMS}',      'DUMBBELL',   'ISOLATION', 'dumbbell-curl'),
  ('Hammer Curl',           'BICEPS', '{FOREARMS}',      'DUMBBELL',   'ISOLATION', 'hammer-curl'),
  ('Preacher Curl',         'BICEPS', '{}',              'BARBELL',    'ISOLATION', 'preacher-curl'),
  ('Incline Dumbbell Curl', 'BICEPS', '{}',              'DUMBBELL',   'ISOLATION', 'incline-dumbbell-curl'),
  ('Cable Curl',            'BICEPS', '{FOREARMS}',      'CABLE',      'ISOLATION', 'cable-curl'),
  ('Concentration Curl',    'BICEPS', '{}',              'DUMBBELL',   'ISOLATION', 'concentration-curl'),
  ('Chin-Ups',              'BICEPS', '{BACK,FOREARMS}', 'BODYWEIGHT', 'PULL',      'chin-ups'),
  ('EZ-Bar Curl',           'BICEPS', '{FOREARMS}',      'BARBELL',    'ISOLATION', 'ez-bar-curl'),
  ('Spider Curl',           'BICEPS', '{}',              'DUMBBELL',   'ISOLATION', 'spider-curl'),

  -- Triceps (10)
  ('Tricep Pushdown',           'TRICEPS', '{}',                  'CABLE',      'ISOLATION', 'tricep-pushdown'),
  ('Skull Crushers',            'TRICEPS', '{}',                  'BARBELL',    'ISOLATION', 'skull-crushers'),
  ('Overhead Tricep Extension', 'TRICEPS', '{}',                  'DUMBBELL',   'ISOLATION', 'overhead-tricep-extension'),
  ('Cable Overhead Extension',  'TRICEPS', '{}',                  'CABLE',      'ISOLATION', 'cable-overhead-extension'),
  ('Close-Grip Bench Press',    'TRICEPS', '{CHEST,SHOULDERS}',   'BARBELL',    'PUSH',      'close-grip-bench-press'),
  ('Tricep Dips',               'TRICEPS', '{CHEST,SHOULDERS}',   'BODYWEIGHT', 'PUSH',      'tricep-dips'),
  ('Dumbbell Kickback',         'TRICEPS', '{}',                  'DUMBBELL',   'ISOLATION', 'dumbbell-kickback'),
  ('Diamond Push-Ups',          'TRICEPS', '{CHEST,CORE}',        'BODYWEIGHT', 'PUSH',      'diamond-push-ups'),
  ('Bench Dips',                'TRICEPS', '{CHEST,SHOULDERS}',   'BODYWEIGHT', 'PUSH',      'bench-dips'),
  ('Machine Tricep Extension',  'TRICEPS', '{}',                  'MACHINE',    'ISOLATION', 'machine-tricep-extension'),

  -- Forearms (5)
  ('Wrist Curl',                 'FOREARMS', '{}',            'BARBELL',  'ISOLATION', 'wrist-curl'),
  ('Reverse Wrist Curl',         'FOREARMS', '{}',            'BARBELL',  'ISOLATION', 'reverse-wrist-curl'),
  ('Reverse Curl',               'FOREARMS', '{BICEPS}',      'BARBELL',  'ISOLATION', 'reverse-curl'),
  ('Farmer''s Carry',            'FOREARMS', '{CORE,BACK}',   'DUMBBELL', 'CARRY',     'farmers-carry'),
  ('Behind-the-Back Wrist Curl', 'FOREARMS', '{}',            'BARBELL',  'ISOLATION', 'behind-the-back-wrist-curl'),

  -- Quads (12)
  ('Squat',                 'QUADS', '{GLUTES,HAMSTRINGS,CORE}', 'BARBELL',    'SQUAT',     'squat'),
  ('Leg Press',             'QUADS', '{GLUTES,HAMSTRINGS}',      'MACHINE',    'SQUAT',     'leg-press'),
  ('Leg Extension',         'QUADS', '{}',                       'MACHINE',    'ISOLATION', 'leg-extension'),
  ('Lunges',                'QUADS', '{GLUTES,HAMSTRINGS}',      'DUMBBELL',   'LUNGE',     'lunges'),
  ('Front Squat',           'QUADS', '{GLUTES,CORE}',            'BARBELL',    'SQUAT',     'front-squat'),
  ('Hack Squat',            'QUADS', '{GLUTES}',                 'MACHINE',    'SQUAT',     'hack-squat'),
  ('Bulgarian Split Squat', 'QUADS', '{GLUTES,HAMSTRINGS}',      'DUMBBELL',   'LUNGE',     'bulgarian-split-squat'),
  ('Goblet Squat',          'QUADS', '{GLUTES,CORE}',            'KETTLEBELL', 'SQUAT',     'goblet-squat'),
  ('Smith Machine Squat',   'QUADS', '{GLUTES}',                 'MACHINE',    'SQUAT',     'smith-machine-squat'),
  ('Walking Lunges',        'QUADS', '{GLUTES,HAMSTRINGS}',      'DUMBBELL',   'LUNGE',     'walking-lunges'),
  ('Step-Ups',              'QUADS', '{GLUTES}',                 'DUMBBELL',   'LUNGE',     'step-ups'),
  ('Sissy Squat',           'QUADS', '{}',                       'BODYWEIGHT', 'SQUAT',     'sissy-squat'),

  -- Hamstrings (8)
  ('Romanian Deadlift',            'HAMSTRINGS', '{GLUTES,BACK}', 'BARBELL',    'HINGE',     'romanian-deadlift'),
  ('Leg Curl',                     'HAMSTRINGS', '{}',            'MACHINE',    'ISOLATION', 'leg-curl'),
  ('Seated Leg Curl',              'HAMSTRINGS', '{}',            'MACHINE',    'ISOLATION', 'seated-leg-curl'),
  ('Stiff-Leg Deadlift',           'HAMSTRINGS', '{GLUTES,BACK}', 'BARBELL',    'HINGE',     'stiff-leg-deadlift'),
  ('Good Morning',                 'HAMSTRINGS', '{GLUTES,BACK}', 'BARBELL',    'HINGE',     'good-morning'),
  ('Nordic Curl',                  'HAMSTRINGS', '{}',            'BODYWEIGHT', 'ISOLATION', 'nordic-curl'),
  ('Single-Leg Romanian Deadlift', 'HAMSTRINGS', '{GLUTES,CORE}', 'DUMBBELL',   'HINGE',     'single-leg-romanian-deadlift'),
  ('Glute-Ham Raise',              'HAMSTRINGS', '{GLUTES}',      'BODYWEIGHT', 'HINGE',     'glute-ham-raise'),

  -- Glutes (8)
  ('Hip Thrust',           'GLUTES', '{HAMSTRINGS}',            'BARBELL',    'HINGE',     'hip-thrust'),
  ('Glute Bridge',         'GLUTES', '{HAMSTRINGS,CORE}',       'BODYWEIGHT', 'HINGE',     'glute-bridge'),
  ('Cable Glute Kickback', 'GLUTES', '{HAMSTRINGS}',            'CABLE',      'ISOLATION', 'cable-glute-kickback'),
  ('Hip Abduction',        'GLUTES', '{}',                      'MACHINE',    'ISOLATION', 'hip-abduction'),
  ('Sumo Deadlift',        'GLUTES', '{HAMSTRINGS,QUADS,BACK}', 'BARBELL',    'HINGE',     'sumo-deadlift'),
  ('Single-Leg Hip Thrust','GLUTES', '{HAMSTRINGS,CORE}',       'BODYWEIGHT', 'HINGE',     'single-leg-hip-thrust'),
  ('Curtsy Lunge',         'GLUTES', '{QUADS}',                 'DUMBBELL',   'LUNGE',     'curtsy-lunge'),
  ('Donkey Kicks',         'GLUTES', '{CORE}',                  'BODYWEIGHT', 'ISOLATION', 'donkey-kicks'),

  -- Calves (5)
  ('Calf Raise',            'CALVES', '{}', 'MACHINE',    'ISOLATION', 'calf-raise'),
  ('Seated Calf Raise',     'CALVES', '{}', 'MACHINE',    'ISOLATION', 'seated-calf-raise'),
  ('Leg Press Calf Raise',  'CALVES', '{}', 'MACHINE',    'ISOLATION', 'leg-press-calf-raise'),
  ('Single-Leg Calf Raise', 'CALVES', '{}', 'BODYWEIGHT', 'ISOLATION', 'single-leg-calf-raise'),
  ('Donkey Calf Raise',     'CALVES', '{}', 'MACHINE',    'ISOLATION', 'donkey-calf-raise'),

  -- Core (16)
  ('Plank',              'CORE', '{SHOULDERS}',       'BODYWEIGHT', 'CORE_BRACE', 'plank'),
  ('Side Plank',         'CORE', '{SHOULDERS}',       'BODYWEIGHT', 'CORE_BRACE', 'side-plank'),
  ('Crunch',             'CORE', '{}',                'BODYWEIGHT', 'ISOLATION',  'crunch'),
  ('Cable Crunch',       'CORE', '{}',                'CABLE',      'ISOLATION',  'cable-crunch'),
  ('Decline Sit-Up',     'CORE', '{}',                'BODYWEIGHT', 'ISOLATION',  'decline-sit-up'),
  ('Hanging Leg Raise',  'CORE', '{FOREARMS}',        'BODYWEIGHT', 'ISOLATION',  'hanging-leg-raise'),
  ('Hanging Knee Raise', 'CORE', '{FOREARMS}',        'BODYWEIGHT', 'ISOLATION',  'hanging-knee-raise'),
  ('Ab Wheel Rollout',   'CORE', '{SHOULDERS,BACK}',  'OTHER',      'CORE_BRACE', 'ab-wheel-rollout'),
  ('Russian Twist',      'CORE', '{}',                'BODYWEIGHT', 'ROTATION',   'russian-twist'),
  ('Dead Bug',           'CORE', '{}',                'BODYWEIGHT', 'CORE_BRACE', 'dead-bug'),
  ('Pallof Press',       'CORE', '{SHOULDERS}',       'CABLE',      'CORE_BRACE', 'pallof-press'),
  ('Hollow Hold',        'CORE', '{}',                'BODYWEIGHT', 'CORE_BRACE', 'hollow-hold'),
  ('Mountain Climbers',  'CORE', '{SHOULDERS,QUADS}', 'BODYWEIGHT', 'CORE_BRACE', 'mountain-climbers'),
  ('Bicycle Crunch',     'CORE', '{}',                'BODYWEIGHT', 'ROTATION',   'bicycle-crunch'),
  ('Woodchopper',        'CORE', '{SHOULDERS}',       'CABLE',      'ROTATION',   'woodchopper'),
  ('V-Ups',              'CORE', '{}',                'BODYWEIGHT', 'ISOLATION',  'v-ups');
