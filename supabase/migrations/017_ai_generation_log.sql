-- ================================================================
-- Migration 017: AI workout generation log
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-016 have already been applied.
--
-- Backs the AI Workout Generator's per-user daily rate limit. The
-- generate-workout Edge Function inserts one row here per attempted
-- generation (successful or not, so a burst of failures still counts
-- against the cap) and counts rows from the last 24h before deciding
-- whether to call the AI provider at all.
-- ================================================================

create table public.ai_generation_log (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_ai_generation_log_user_created
  on public.ai_generation_log (user_id, created_at);

alter table public.ai_generation_log enable row level security;

create policy ai_generation_log_select_own on public.ai_generation_log
  for select using (auth.uid() = user_id);
create policy ai_generation_log_insert_own on public.ai_generation_log
  for insert with check (auth.uid() = user_id);

-- No update/delete policy — log rows are append-only and self-expire by
-- simply aging out of the 24h window the Edge Function queries.
