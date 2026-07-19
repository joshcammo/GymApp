-- ================================================================
-- Migration 013: share by exercise, not by day-row
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-012 have already been applied.
--
-- share_post() previously took an exercises.id and shared the best
-- set from that ONE specific logged day's row — so sharing only
-- worked right after logging a PR, from that day's entry, and there
-- was no way to go back and share an exercise's current best later.
-- It now takes an exercise_def_id and always shares the caller's
-- current best set for that exercise across their whole history —
-- the same "current record" semantics as exercise_set_pr_flags /
-- get_exercise_pr (migrations 006/003). Tapping a PR badge on
-- today's entry and picking the same exercise from the new "share a
-- PR" picker now produce an identical post.
--
-- The parameter TYPE signature (bigint, text) is unchanged, but
-- Postgres still refuses to rename a parameter via `create or
-- replace` (42P13) — the old p_exercise_id name has to be dropped
-- first, same as the signature changes in migration 006.
-- ================================================================

drop function if exists public.share_post(bigint, text);

create function public.share_post(p_exercise_def_id bigint, p_caption text default null)
returns bigint
language plpgsql
security invoker
as $$
declare
  v_name    text;
  v_best    record;
  v_post_id bigint;
begin
  select name into v_name
  from public.exercise_defs
  where id = p_exercise_def_id and (user_id is null or user_id = auth.uid());

  if not found then
    raise exception 'Exercise % not found or not accessible', p_exercise_def_id
      using errcode = 'P0002';
  end if;

  select e.unit, s.reps, s.weight into v_best
  from public.exercise_sets s
  join public.exercises e on e.id = s.exercise_id
  where e.user_id = auth.uid()
    and e.exercise_def_id = p_exercise_def_id
    and s.weight is not null and s.weight > 0
  order by public.to_kg(s.weight, e.unit) desc, coalesce(s.reps, 0) desc, s.id
  limit 1;

  if v_best.weight is null then
    raise exception 'You have not logged a weighted set for this exercise yet';
  end if;

  insert into public.posts (user_id, exercise_name, weight, reps, unit, e1rm_kg, caption)
  values (
    auth.uid(),
    v_name,
    v_best.weight,
    v_best.reps,
    v_best.unit,
    case when v_best.reps is not null and v_best.reps > 1
      then round(public.to_kg(v_best.weight, v_best.unit) * (1 + v_best.reps / 30.0), 1)
      else null
    end,
    nullif(btrim(p_caption), '')
  )
  returning id into v_post_id;

  return v_post_id;
end;
$$;

grant execute on function public.share_post(bigint, text) to authenticated;

-- ── View: exercises the caller has logged, with their current best set ─
-- Backs the "share a PR" picker on the Feed tab. Same tie-break as
-- share_post() above, via DISTINCT ON (picks the first row per
-- exercise_def_id in tie-break order).
create view public.my_exercise_prs
with (security_invoker = true) as
select distinct on (e.exercise_def_id)
  e.exercise_def_id,
  d.name,
  e.unit,
  s.weight,
  s.reps,
  case when s.reps is not null and s.reps > 1
    then round(public.to_kg(s.weight, e.unit) * (1 + s.reps / 30.0), 1)
    else null
  end as e1rm_kg
from public.exercises e
join public.exercise_sets s on s.exercise_id = e.id
join public.exercise_defs d on d.id = e.exercise_def_id
where e.user_id = auth.uid()
  and e.exercise_def_id is not null
  and s.weight is not null and s.weight > 0
order by e.exercise_def_id, public.to_kg(s.weight, e.unit) desc, coalesce(s.reps, 0) desc, s.id;

grant select on public.my_exercise_prs to authenticated;
