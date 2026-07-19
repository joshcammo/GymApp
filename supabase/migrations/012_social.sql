-- ================================================================
-- Migration 012: social sharing (profiles, friends, posts)
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-011 have already been applied.
--
-- Lets a user share a logged set with friends as a "post" (a
-- snapshot of exercise name/weight/reps/e1RM at share time, not a
-- live link to the exercises table — exercises stays owner-only via
-- RLS, and a share is a deliberate, one-time act, not an ongoing
-- grant of access to the user's full log). Friendship is mutual and
-- request-based (pending -> accepted); a post is visible to its
-- author and their accepted friends only, enforced by RLS.
--
-- All functions are `security invoker` and RLS does the per-user
-- filtering, same convention as every other RPC/view in this
-- project — with one exception: handle_new_user(), which must be
-- `security definer` because it runs as part of the Supabase auth
-- signup flow, before any RLS-visible session exists for the new
-- row it's inserting.
-- ================================================================

-- ── profiles ────────────────────────────────────────────────────
-- One row per auth user, auto-created on signup (see trigger below)
-- with username left null. The app prompts the user to set one
-- (via set_username) before unlocking the social section — usernames,
-- not emails, are what friends search each other by.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text check (username is null or (char_length(username) between 3 and 20 and username ~ '^[a-z0-9_]+$')),
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 50),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index uq_profiles_username on public.profiles (lower(username)) where username is not null;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Any authenticated user can look up any profile by username/display
-- name (friend search needs this); profiles carry no sensitive data.
create policy profiles_select_all on public.profiles
  for select using (true);
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ── Auto-create a profile row on signup ─────────────────────────
-- security definer + fixed search_path: the standard safe pattern
-- for a trigger on auth.users, which the signing-up user has no
-- session (and thus no RLS-granted insert) for yet.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger trg_create_profile
after insert on auth.users
for each row execute function public.handle_new_user();

-- ── RPC: claim a username ────────────────────────────────────────
create function public.set_username(p_username text)
returns void
language plpgsql
security invoker
as $$
begin
  if p_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 characters: lowercase letters, numbers, underscore only';
  end if;

  begin
    update public.profiles
    set username = p_username,
        display_name = coalesce(display_name, p_username)
    where id = auth.uid();
  exception when unique_violation then
    raise exception 'Username "%" is already taken', p_username;
  end;

  if not found then
    raise exception 'Profile not found for current user' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.set_username(text) to authenticated;

-- ── friendships ─────────────────────────────────────────────────
-- One row per pair, status pending -> accepted. The unique index is
-- direction-agnostic (least/greatest) so a user can't route around
-- an existing pending/accepted row by sending the reverse request.
create table public.friendships (
  id           bigint generated always as identity primary key,
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

create unique index uq_friendships_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friendships enable row level security;

create policy friendships_select_own on public.friendships
  for select using (auth.uid() in (requester_id, addressee_id));
create policy friendships_insert_own on public.friendships
  for insert with check (requester_id = auth.uid());
-- Only the addressee can act on a pending request, and only to accept it
-- (decline/cancel/unfriend go through the delete policy below instead).
create policy friendships_update_addressee on public.friendships
  for update
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted');
create policy friendships_delete_own on public.friendships
  for delete using (auth.uid() in (requester_id, addressee_id));

-- ── Helper: are two users accepted friends? ─────────────────────
-- Used by posts/post_likes/post_comments RLS below. security invoker
-- so the inner query is still filtered by friendships' own RLS —
-- harmless here since the caller (auth.uid()) is always one side of
-- the pair being checked, so their select policy already admits it.
create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ── RPC: send (or auto-accept) a friend request by username ─────
create function public.send_friend_request(p_username text)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_target   uuid;
  v_existing public.friendships%rowtype;
begin
  select id into v_target from public.profiles where lower(username) = lower(p_username);
  if v_target is null then
    raise exception 'No user found with username "%"', p_username using errcode = 'P0002';
  end if;
  if v_target = auth.uid() then
    raise exception 'You can''t send a friend request to yourself';
  end if;

  select * into v_existing from public.friendships
  where least(requester_id, addressee_id) = least(auth.uid(), v_target)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), v_target);

  if found then
    if v_existing.status = 'accepted' then
      raise exception 'You''re already friends with %', p_username;
    elsif v_existing.requester_id = v_target then
      -- They already requested us — accept theirs instead of creating a duplicate.
      update public.friendships
      set status = 'accepted', responded_at = now()
      where id = v_existing.id;
      return jsonb_build_object('status', 'accepted');
    else
      raise exception 'Friend request already sent';
    end if;
  end if;

  -- Concurrent mutual requests can both pass the check above before either
  -- commits; the loser hits uq_friendships_pair here instead of the
  -- select-and-branch logic above, so give it the same friendly message
  -- rather than letting a raw unique_violation reach the client.
  begin
    insert into public.friendships (requester_id, addressee_id) values (auth.uid(), v_target);
  exception when unique_violation then
    raise exception 'Friend request already sent';
  end;
  return jsonb_build_object('status', 'pending');
end;
$$;

grant execute on function public.send_friend_request(text) to authenticated;

-- ── RPC: accept or decline a pending request addressed to me ────
create function public.respond_friend_request(p_id bigint, p_accept boolean)
returns void
language plpgsql
security invoker
as $$
begin
  if p_accept then
    update public.friendships
    set status = 'accepted', responded_at = now()
    where id = p_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from public.friendships
    where id = p_id and addressee_id = auth.uid() and status = 'pending';
  end if;

  if not found then
    raise exception 'Friend request % not found or not addressed to caller', p_id
      using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.respond_friend_request(bigint, boolean) to authenticated;

-- ── View: my friendships, joined with the other user's profile ──
create view public.friendships_with_profiles
with (security_invoker = true) as
select
  f.id, f.status, f.created_at, f.responded_at,
  (f.requester_id = auth.uid())                                             as is_requester,
  case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as other_user_id,
  p.username                                                                as other_username,
  p.display_name                                                            as other_display_name
from public.friendships f
join public.profiles p
  on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
where auth.uid() in (f.requester_id, f.addressee_id);

grant select on public.friendships_with_profiles to authenticated;

-- ── posts ───────────────────────────────────────────────────────
-- A snapshot, not a live join to exercises/exercise_sets — see
-- header note. weight/reps/unit/e1rm_kg are always derived
-- server-side from the caller's own logged set by share_post()
-- below, never taken as raw client input.
create table public.posts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null check (char_length(btrim(exercise_name)) > 0 and char_length(exercise_name) <= 255),
  weight        numeric(10,2) not null check (weight > 0),
  reps          int check (reps is null or (reps >= 1 and reps <= 1000)),
  unit          text not null default 'KG' check (unit in ('KG', 'LBS')),
  e1rm_kg       numeric(10,2),
  caption       text check (caption is null or char_length(caption) <= 280),
  created_at    timestamptz not null default now()
);

create index idx_posts_user_created on public.posts (user_id, created_at desc);

alter table public.posts enable row level security;

create policy posts_select_own_or_friend on public.posts
  for select using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));
create policy posts_insert_own on public.posts
  for insert with check (user_id = auth.uid());
create policy posts_delete_own on public.posts
  for delete using (user_id = auth.uid());

-- ── RPC: share a set from one of the caller's own exercises ─────
-- Shares the exercise's current heaviest set (same tie-break as
-- get_exercise_pr in migration 006: highest kg-normalized weight,
-- then most reps). Deriving values server-side, from the caller's
-- own exercise_sets row, keeps a post's numbers tied to something
-- the user actually logged rather than free-form client input.
create function public.share_post(p_exercise_id bigint, p_caption text default null)
returns bigint
language plpgsql
security invoker
as $$
declare
  v_exercise public.exercises%rowtype;
  v_set      record;
  v_post_id  bigint;
begin
  select * into v_exercise
  from public.exercises
  where id = p_exercise_id and user_id = auth.uid();

  if not found then
    raise exception 'Exercise % not found or not owned by caller', p_exercise_id
      using errcode = 'P0002';
  end if;

  select s.reps, s.weight into v_set
  from public.exercise_sets s
  where s.exercise_id = p_exercise_id and s.weight is not null
  order by public.to_kg(s.weight, v_exercise.unit) desc, coalesce(s.reps, 0) desc, s.id
  limit 1;

  if v_set.weight is null then
    raise exception 'This exercise has no weighted sets to share';
  end if;

  insert into public.posts (user_id, exercise_name, weight, reps, unit, e1rm_kg, caption)
  values (
    auth.uid(),
    v_exercise.name,
    v_set.weight,
    v_set.reps,
    v_exercise.unit,
    case when v_set.reps is not null and v_set.reps > 1
      then round(public.to_kg(v_set.weight, v_exercise.unit) * (1 + v_set.reps / 30.0), 1)
      else null
    end,
    nullif(btrim(p_caption), '')
  )
  returning id into v_post_id;

  return v_post_id;
end;
$$;

grant execute on function public.share_post(bigint, text) to authenticated;

-- ── post_likes ──────────────────────────────────────────────────
create table public.post_likes (
  post_id    bigint not null references public.posts(id) on delete cascade,
  -- Defaults to the caller so the client can insert {post_id} alone;
  -- the insert policy below still enforces user_id = auth.uid().
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

create policy post_likes_select_visible on public.post_likes
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_likes.post_id
        and (p.user_id = auth.uid() or public.are_friends(p.user_id, auth.uid()))
    )
  );
create policy post_likes_insert_own on public.post_likes
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = post_likes.post_id
        and (p.user_id = auth.uid() or public.are_friends(p.user_id, auth.uid()))
    )
  );
create policy post_likes_delete_own on public.post_likes
  for delete using (user_id = auth.uid());

-- ── post_comments ───────────────────────────────────────────────
create table public.post_comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references public.posts(id) on delete cascade,
  -- Defaults to the caller — see post_likes.user_id above.
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index idx_post_comments_post on public.post_comments (post_id, created_at asc);

alter table public.post_comments enable row level security;

create policy post_comments_select_visible on public.post_comments
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id
        and (p.user_id = auth.uid() or public.are_friends(p.user_id, auth.uid()))
    )
  );
create policy post_comments_insert_own on public.post_comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id
        and (p.user_id = auth.uid() or public.are_friends(p.user_id, auth.uid()))
    )
  );
create policy post_comments_delete_own on public.post_comments
  for delete using (user_id = auth.uid());

-- ── View: feed — posts joined with author profile + like/comment counts ─
create view public.posts_feed
with (security_invoker = true) as
select
  po.id, po.user_id, po.exercise_name, po.weight, po.reps, po.unit, po.e1rm_kg, po.caption, po.created_at,
  pr.username, pr.display_name,
  (select count(*) from public.post_likes pl where pl.post_id = po.id)                              as like_count,
  exists (select 1 from public.post_likes pl where pl.post_id = po.id and pl.user_id = auth.uid())  as liked_by_me,
  (select count(*) from public.post_comments pc where pc.post_id = po.id)                           as comment_count
from public.posts po
join public.profiles pr on pr.id = po.user_id;

grant select on public.posts_feed to authenticated;

-- ── View: comments joined with author profile ────────────────────
create view public.post_comments_with_profiles
with (security_invoker = true) as
select
  pc.id, pc.post_id, pc.user_id, pc.body, pc.created_at,
  pr.username, pr.display_name
from public.post_comments pc
join public.profiles pr on pr.id = pc.user_id;

grant select on public.post_comments_with_profiles to authenticated;
