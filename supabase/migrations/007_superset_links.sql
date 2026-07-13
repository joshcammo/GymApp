-- ================================================================
-- Migration 007: superset links
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-006 have already been applied.
--
-- Lets two exercises logged on the same day be paired into a
-- superset. The pairing is a single self-referential column rather
-- than a join table: `on delete set null` means deleting either
-- exercise automatically un-pairs the other, no cleanup trigger
-- needed. Both sides always mirror each other (A.partner = B.id
-- implies B.partner = A.id) — enforced by set_superset_partner
-- below, never written directly from the client.
--
-- Purely additive: no existing column or RPC signature changes.
-- PR logic is untouched — it keys off exercise_def_id regardless of
-- superset grouping.
--
-- NOTE: exercises_with_pr (migration 003) is `select e.*, has_pr`,
-- but Postgres freezes a view's `*` expansion at creation time, so
-- this new column does NOT flow through to it automatically as
-- originally assumed here — migration 008 recreates that view to
-- pick it up (and exercise_def_id from migration 005, missed the
-- same way).
-- ================================================================

alter table public.exercises
  add column superset_partner_id bigint references public.exercises(id) on delete set null,
  add constraint exercises_superset_not_self
    check (superset_partner_id is null or superset_partner_id <> id);

create index idx_exercises_superset_partner
  on public.exercises (superset_partner_id) where superset_partner_id is not null;

-- ── RPC: link/relink/unlink two exercises as a superset ─────────
-- p_partner_id = null unlinks p_exercise_id (and, if it had one,
-- clears its old partner's pointer back too). Relinking to a new
-- partner transparently breaks any stale pairing on either side
-- first, so the column can never point at someone who doesn't
-- point back.
create function public.set_superset_partner(
  p_exercise_id bigint,
  p_partner_id  bigint default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_date         date;
  v_old_partner  bigint;
  v_partner_date date;
  v_partner_old  bigint;
begin
  select date, superset_partner_id into v_date, v_old_partner
    from public.exercises
    where id = p_exercise_id and user_id = auth.uid()
    for update;

  if not found then
    raise exception 'Exercise % not found or not owned by caller', p_exercise_id
      using errcode = 'P0002';
  end if;

  if p_partner_id is not null and p_partner_id = p_exercise_id then
    raise exception 'An exercise cannot be linked to itself';
  end if;

  -- Break the old pairing on the old partner's side (no-op if there
  -- wasn't one, or if it's the same partner being re-set).
  if v_old_partner is not null and v_old_partner is distinct from p_partner_id then
    update public.exercises set superset_partner_id = null
      where id = v_old_partner and superset_partner_id = p_exercise_id;
  end if;

  if p_partner_id is null then
    update public.exercises set superset_partner_id = null where id = p_exercise_id;
    return;
  end if;

  select date, superset_partner_id into v_partner_date, v_partner_old
    from public.exercises
    where id = p_partner_id and user_id = auth.uid()
    for update;

  if not found then
    raise exception 'Partner exercise % not found or not owned by caller', p_partner_id
      using errcode = 'P0002';
  end if;

  if v_partner_date <> v_date then
    raise exception 'Superset partners must be logged on the same day';
  end if;

  -- Break the new partner's existing pairing too, if it had a
  -- different one.
  if v_partner_old is not null and v_partner_old <> p_exercise_id then
    update public.exercises set superset_partner_id = null
      where id = v_partner_old and superset_partner_id = p_partner_id;
  end if;

  update public.exercises set superset_partner_id = p_partner_id where id = p_exercise_id;
  update public.exercises set superset_partner_id = p_exercise_id where id = p_partner_id;
end;
$$;

grant execute on function public.set_superset_partner(bigint, bigint) to authenticated;
