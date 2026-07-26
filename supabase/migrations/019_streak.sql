-- ================================================================
-- Migration 019: current streak
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-018 have already been applied.
--
-- One RPC backing the dashboard's streak banner: consecutive calendar
-- days, ending today or yesterday, with at least one exercise or
-- cardio session logged. "Ending yesterday" (not just today) means a
-- streak isn't shown as broken before today is even over — it only
-- actually breaks once a full day passes with nothing logged.
-- security invoker, scoped via auth.uid(), same as every other RPC in
-- this project.
-- ================================================================

create function public.get_current_streak()
returns int
language plpgsql
stable
security invoker
as $$
declare
  v_streak     int := 0;
  v_check_date date := current_date;
  v_has_today  boolean;
begin
  select exists(
    select 1 from public.exercises
    where user_id = auth.uid() and date = current_date
    union
    select 1 from public.cardio_sessions
    where user_id = auth.uid() and date = current_date
  ) into v_has_today;

  if not v_has_today then
    v_check_date := current_date - 1;
  end if;

  loop
    exit when not exists(
      select 1 from public.exercises
      where user_id = auth.uid() and date = v_check_date
      union
      select 1 from public.cardio_sessions
      where user_id = auth.uid() and date = v_check_date
    );
    v_streak := v_streak + 1;
    v_check_date := v_check_date - 1;
  end loop;

  return v_streak;
end;
$$;

grant execute on function public.get_current_streak() to authenticated;
