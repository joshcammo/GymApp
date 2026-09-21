-- ================================================================
-- Migration 023: moderation + account deletion
--
-- Run this once in the Supabase SQL editor against a project where
-- migrations 001-022 have already been applied.
--
-- App Store Review Guideline 1.2 requires every app carrying
-- user-generated content to ship four things: a filter for
-- objectionable material, a way to report it, a way to block abusive
-- users, and published contact information. This app has UGC —
-- usernames, display names, post captions and comments — and had
-- none of the first three. Guideline 5.1.1(v) separately requires
-- in-app account deletion for any app that supports account
-- creation.
--
-- This migration adds the database half of all four:
--
--   1. user_blocks + block_user()/unblock_user() — a block is
--      mutual, immediate, and enforced in RLS rather than hidden in
--      the client.
--   2. content_reports + report_content() — reports are write-only
--      for users and read via the SQL editor (service role bypasses
--      RLS). Reports outlive the content they describe.
--   3. blocked_terms + is_objectionable() + BEFORE triggers — server-
--      side rejection of objectionable usernames, display names,
--      captions and comments.
--   4. delete_my_account() — erases the caller's auth.users row.
--
-- Contact information is the fourth 1.2 requirement and lives
-- outside the database, on the public support page (see /docs).
-- ================================================================


-- ════════════════════════════════════════════════════════════════
--  1. BLOCKING
-- ════════════════════════════════════════════════════════════════

-- One row per (blocker, blocked) direction. Deliberately *not* a
-- direction-agnostic pair like friendships: two users can block each
-- other independently, and unblocking is one-sided.
create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id uuid not null                    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- is_blocked() probes the reverse direction too, which has no index
-- from the primary key alone.
create index idx_user_blocks_blocked on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

-- Only the blocker can see, create or remove their own blocks. There
-- is deliberately no policy exposing rows where blocked_id =
-- auth.uid(): a blocked user should not be handed a list of everyone
-- who has blocked them.
create policy user_blocks_select_own on public.user_blocks
  for select using (blocker_id = auth.uid());
create policy user_blocks_insert_own on public.user_blocks
  for insert with check (blocker_id = auth.uid());
create policy user_blocks_delete_own on public.user_blocks
  for delete using (blocker_id = auth.uid());

-- ── Helper: has either user blocked the other? ──────────────────
-- security definer, because the whole point is to see a row the
-- caller's own RLS policy hides from them — "did they block me?"
-- reads a row whose blocker_id is the *other* user. A security
-- invoker function would silently return false for exactly the case
-- that matters most.
--
-- Because it is definer and granted to authenticated, it is callable
-- directly over the REST API with any two ids — and profile search
-- hands out ids freely. The auth.uid() guard is what stops that being
-- a way to map the block graph between two unrelated third parties;
-- without it, anyone could enumerate who has blocked whom. Every
-- legitimate caller (the policies below, are_friends, block checks in
-- the RPCs) passes the caller as one side of the pair.
--
-- It still lets a user learn whether someone has blocked *them*. That
-- is already inferable from the app's behaviour — their content
-- disappears — and the alternative is a block that only works in one
-- direction. Accepted deliberately.
--
-- Returns false rather than raising for a pair the caller is not part
-- of: are_friends() is itself callable directly, and an exception
-- inside it would propagate into RLS policy evaluation. False is safe
-- here because no policy ever asks about a pair it is not part of.
create function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() in (a, b)
     and exists (
       select 1 from public.user_blocks ub
       where (ub.blocker_id = a and ub.blocked_id = b)
          or (ub.blocker_id = b and ub.blocked_id = a)
     );
$$;

revoke execute on function public.is_blocked(uuid, uuid) from public;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- ── Fold blocking into are_friends() ────────────────────────────
-- are_friends() (migration 012) gates the select/insert policies on
-- posts, post_likes and post_comments. Rewriting it here, rather
-- than editing six policies, means a block propagates everywhere
-- those policies already reach — including any policy added later
-- that reuses the helper.
--
-- block_user() below also deletes the friendship row, so this check
-- is belt-and-braces. It is kept because the two facts should not
-- be able to drift: as long as a block exists, the pair are not
-- friends, whatever the friendships table happens to say.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security invoker
as $$
  select not public.is_blocked(a, b)
     and exists (
       select 1 from public.friendships f
       where f.status = 'accepted'
         and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
     );
$$;

-- ── Hide a blocked user's comments and likes on shared posts ────
-- Post visibility is handled by are_friends() above, but comments
-- and likes are gated on visibility of the *post*, not of their own
-- author. Without this, A and B blocking each other would still see
-- each other's comments underneath a post by mutual friend C.
drop policy post_comments_select_visible on public.post_comments;
create policy post_comments_select_visible on public.post_comments
  for select using (
    not public.is_blocked(post_comments.user_id, auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id
        and (p.user_id = auth.uid() or public.are_friends(p.user_id, auth.uid()))
    )
  );

drop policy post_likes_select_visible on public.post_likes;
create policy post_likes_select_visible on public.post_likes
  for select using (
    not public.is_blocked(post_likes.user_id, auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_likes.post_id
        and (p.user_id = auth.uid() or public.are_friends(p.user_id, auth.uid()))
    )
  );

-- ── Hide blocked users from profile lookup ──────────────────────
-- profiles_select_all (migration 012) was `using (true)` so friend
-- search could find anyone. A blocked user must not surface in
-- search, or the block is trivially worked around by re-sending a
-- friend request.
--
-- id = auth.uid() is never affected: the check constraint on
-- user_blocks forbids blocking yourself, so is_blocked(me, me) is
-- always false and a user can always read their own profile.
drop policy profiles_select_all on public.profiles;
create policy profiles_select_visible on public.profiles
  for select using (not public.is_blocked(id, auth.uid()));

-- ── RPC: block a user ───────────────────────────────────────────
-- Inserting the block and dropping the friendship in one statement
-- pair keeps the two consistent: a friend you block stops being a
-- friend, so neither of you keeps seeing posts the other shared
-- while the friendship lingered.
create function public.block_user(p_user_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  if p_user_id is null then
    raise exception 'A user to block is required' using errcode = 'P0002';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You can''t block yourself';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (auth.uid(), p_user_id)
  on conflict do nothing;

  -- Covers pending requests in both directions as well as an
  -- accepted friendship — blocking should clear all of them.
  delete from public.friendships
  where least(requester_id, addressee_id)    = least(auth.uid(), p_user_id)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user_id);
end;
$$;

revoke execute on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

-- ── RPC: unblock ────────────────────────────────────────────────
-- Unblocking does not restore the friendship. Re-adding someone you
-- blocked should be a deliberate act, not a side effect.
create function public.unblock_user(p_user_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.user_blocks
  where blocker_id = auth.uid() and blocked_id = p_user_id;
end;
$$;

revoke execute on function public.unblock_user(uuid) from public;
grant execute on function public.unblock_user(uuid) to authenticated;

-- ── View: my blocked users, with their profile ──────────────────
-- security definer on the view's underlying lookup is unnecessary —
-- but profiles_select_visible now hides blocked users from the
-- blocker, which would make this view return no usernames at all.
-- Reading the username straight from the table in a definer function
-- is the narrowest way to punch through that, exposing only the
-- usernames of people the caller has themselves blocked.
create function public.my_blocked_users()
returns table (user_id uuid, username text, display_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ub.blocked_id, p.username, p.display_name, ub.created_at
  from public.user_blocks ub
  join public.profiles p on p.id = ub.blocked_id
  where ub.blocker_id = auth.uid()
  order by ub.created_at desc;
$$;

revoke execute on function public.my_blocked_users() from public;
grant execute on function public.my_blocked_users() to authenticated;

-- ── Refuse friend requests across a block ───────────────────────
-- Replaces the migration 012 definition, adding the block check.
-- The error message is deliberately the same as "no such user":
-- telling the sender they have been blocked invites retaliation and
-- confirms the block to someone who should not learn of it.
create or replace function public.send_friend_request(p_username text)
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
  if public.is_blocked(auth.uid(), v_target) then
    raise exception 'No user found with username "%"', p_username using errcode = 'P0002';
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


-- ════════════════════════════════════════════════════════════════
--  2. REPORTING
-- ════════════════════════════════════════════════════════════════

-- Reports are append-only from the app's point of view and are read
-- out of band, in the SQL editor, where the service role bypasses
-- RLS. There is no select policy at all, so no user can read the
-- moderation queue — not even their own reports.
--
-- Every foreign key is ON DELETE SET NULL rather than CASCADE: a
-- report must outlive both the content it describes and the accounts
-- involved, or deleting the offending post would also destroy the
-- record of it having been reported. target_snapshot preserves what
-- was actually reported for the same reason.
create table public.content_reports (
  id                bigint generated always as identity primary key,
  reporter_id       uuid    default auth.uid() references auth.users(id)         on delete set null,
  target_type       text    not null check (target_type in ('post', 'comment', 'user')),
  target_post_id    bigint  references public.posts(id)          on delete set null,
  target_comment_id bigint  references public.post_comments(id)  on delete set null,
  target_user_id    uuid    references auth.users(id)            on delete set null,
  -- Denormalised copy of the reported author's username and the
  -- reported text, captured at report time.
  target_username   text,
  target_snapshot   text,
  reason            text not null check (reason in
                      ('harassment', 'hate', 'sexual', 'violence', 'spam', 'impersonation', 'other')),
  details           text check (details is null or char_length(details) <= 500),
  status            text not null default 'open'
                      check (status in ('open', 'actioned', 'dismissed')),
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz,
  reviewer_notes    text,
  -- Exactly one target id, matching target_type.
  constraint content_reports_target_matches_type check (
    (target_type = 'post'    and target_post_id    is not null and target_comment_id is null and target_user_id is null) or
    (target_type = 'comment' and target_comment_id is not null and target_post_id    is null and target_user_id is null) or
    (target_type = 'user'    and target_user_id    is not null and target_post_id    is null and target_comment_id is null)
  )
);

create index idx_content_reports_open
  on public.content_reports (created_at desc) where status = 'open';

-- One report per user per piece of content, so a report button can't
-- be used to flood the queue. Partial on reporter_id is not null:
-- once a reporter deletes their account their reporter_id becomes
-- null, and without the predicate NULLS NOT DISTINCT would make the
-- second such deletion collide and break the ON DELETE SET NULL.
create unique index uq_content_reports_one_per_reporter
  on public.content_reports (reporter_id, target_type, target_post_id, target_comment_id, target_user_id)
  nulls not distinct
  where reporter_id is not null;

alter table public.content_reports enable row level security;

-- Deliberately NO policies of any kind, and the grants revoked on top.
-- RLS with no policy already denies everything to a non-owning role,
-- which is what keeps the moderation queue unreadable — but an INSERT
-- policy here would also make the table *writable* straight over the
-- REST API, and every column with it. An attacker could then file
-- reports carrying a fabricated target_username and target_snapshot,
-- i.e. plant invented evidence against an innocent user and have a
-- moderator act on it. Reports may only be created through
-- report_content() below, which derives those fields itself.
revoke all on public.content_reports from anon, authenticated;

-- ── RPC: report a post, comment or user ─────────────────────────
-- security definer, because the table above accepts no writes from
-- the authenticated role at all. That means RLS no longer filters the
-- lookups below, so entitlement is checked explicitly instead: you may
-- only report something you could actually see. Without that check a
-- definer function would happily snapshot any post in the database
-- back into a report.
--
-- Returns void rather than the new report id on purpose. The queue has
-- no select policy, and the id is of no use to the client.
--
-- Report first, then block. Both visibility checks below run through
-- are_friends()/is_blocked(), so once a block exists the reporter can
-- no longer "see" the content and the report is refused. The
-- report-then-block ordering is enforced in the client, in
-- reportsApi.reportAndBlock.
create function public.report_content(
  p_target_type text,
  p_reason      text,
  p_post_id     bigint default null,
  p_comment_id  bigint default null,
  p_user_id     uuid   default null,
  p_details     text   default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username   text;
  v_snapshot   text;
  v_author     uuid;
  v_post_owner uuid;
  v_visible    boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_target_type = 'post' then
    select pr.username, coalesce(po.caption, po.exercise_name), po.user_id
      into v_username, v_snapshot, v_author
    from public.posts po
    join public.profiles pr on pr.id = po.user_id
    where po.id = p_post_id;
    v_visible := v_author = auth.uid() or public.are_friends(v_author, auth.uid());
  elsif p_target_type = 'comment' then
    select pr.username, pc.body, pc.user_id, po.user_id
      into v_username, v_snapshot, v_author, v_post_owner
    from public.post_comments pc
    join public.profiles pr on pr.id = pc.user_id
    join public.posts po     on po.id = pc.post_id
    where pc.id = p_comment_id;
    -- Mirrors post_comments_select_visible: the post has to be visible
    -- to the caller and the comment's own author must not be blocked.
    v_visible := (v_post_owner = auth.uid() or public.are_friends(v_post_owner, auth.uid()))
                 and not public.is_blocked(v_author, auth.uid());
  elsif p_target_type = 'user' then
    select pr.username, coalesce(pr.display_name, pr.username), pr.id
      into v_username, v_snapshot, v_author
    from public.profiles pr
    where pr.id = p_user_id;
    v_visible := not public.is_blocked(v_author, auth.uid());
  else
    raise exception 'Unknown report target type "%"', p_target_type;
  end if;

  -- Tested on v_author rather than FOUND: the v_visible assignments
  -- above run queries of their own, and relying on FOUND surviving
  -- them would be subtle. Every source table has a NOT NULL author
  -- column, so a null here means nothing matched.
  --
  -- Same message either way: whether a given post id exists is not
  -- something a stranger should be able to probe for.
  if v_author is null or not v_visible then
    raise exception 'That content no longer exists' using errcode = 'P0002';
  end if;
  if v_author = auth.uid() then
    raise exception 'You can''t report your own content';
  end if;

  begin
    insert into public.content_reports (
      target_type, target_post_id, target_comment_id, target_user_id,
      target_username, target_snapshot, reason, details
    ) values (
      p_target_type, p_post_id, p_comment_id, p_user_id,
      v_username, left(v_snapshot, 1000), p_reason, nullif(btrim(p_details), '')
    );
  exception when unique_violation then
    raise exception 'You have already reported this. We are reviewing it.';
  end;
end;
$$;

revoke execute on function public.report_content(text, text, bigint, bigint, uuid, text) from public;
grant execute on function public.report_content(text, text, bigint, bigint, uuid, text) to authenticated;


-- ════════════════════════════════════════════════════════════════
--  3. OBJECTIONABLE CONTENT FILTER
-- ════════════════════════════════════════════════════════════════

-- The list holds slurs and sexually explicit terms — the categories
-- Guideline 1.1 calls objectionable. It deliberately does *not* hold
-- ordinary profanity: a caption reading "leg day was brutal as hell"
-- is not objectionable content, and blocking it would train users to
-- see the filter as noise rather than a rule.
--
-- Terms are constrained to lowercase alphanumerics because
-- is_objectionable() interpolates them into a regular expression.
-- Without that constraint, a term containing regex metacharacters
-- would be an injection into every content check in the app.
create table public.blocked_terms (
  term       text primary key check (term ~ '^[a-z0-9]{3,40}$'),
  created_at timestamptz not null default now()
);

alter table public.blocked_terms enable row level security;
-- No policies: the list is invisible to users, and is read only
-- through is_objectionable() below, which is security definer.
-- Publishing it would be publishing an evasion guide.

-- ── Normalise text before matching ──────────────────────────────
-- Filters get evaded with capitals, leetspeak and padding, so match
-- against a normalised form rather than the raw string:
--   lowercase -> leet digits/symbols folded back to letters ->
--   runs of 3+ identical characters collapsed to 2 ("fuuuuck") ->
--   every non-alphanumeric run reduced to a single space.
create function public.normalize_for_filter(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           regexp_replace(
             -- 0->o 1->l 3->e 4->a 5->s 7->t @->a $->s !->i |->l
             translate(lower(coalesce(p_text, '')), '013457@$!|', 'oleastasil'),
             '(.)\1{2,}', '\1\1', 'g'),
           '[^a-z0-9]+', ' ', 'g');
$$;

-- ── Does this text contain a blocked term? ──────────────────────
-- Matches on word boundaries against the normalised text. Because
-- normalisation has already reduced every non-alphanumeric run to a
-- space, this is effectively whole-word matching.
--
-- Whole-word matching is the deliberate choice. Substring matching
-- would catch a little more evasion at the cost of rejecting
-- "scraped my shin" for containing "raped" and "raccoon" for
-- containing "coon" — the Scunthorpe problem. A filter that blocks
-- innocent captions teaches users the rule is noise; one that misses
-- letter-padded evasion leaves a gap that report and block are there
-- to close. Extend the list from what reports actually surface
-- rather than loosening the matching.
create function public.is_objectionable(p_text text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.blocked_terms t
    where public.normalize_for_filter(p_text)
          ~ ('(^|[^a-z0-9])' || t.term || '([^a-z0-9]|$)')
  );
$$;

revoke execute on function public.is_objectionable(text) from public;
grant execute on function public.is_objectionable(text) to authenticated;

-- ── Trigger: reject objectionable content on write ──────────────
-- Column names come in as trigger arguments so one function covers
-- captions, comment bodies, usernames and display names. The raised
-- message is written to be shown to the user as-is.
create function public.enforce_content_filter()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_col text;
  v_val text;
begin
  foreach v_col in array tg_argv loop
    v_val := to_jsonb(new) ->> v_col;
    if v_val is not null and public.is_objectionable(v_val) then
      raise exception 'That % contains language that isn''t allowed on GymTracker.',
        replace(v_col, '_', ' ')
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

create trigger trg_posts_content_filter
before insert or update of caption on public.posts
for each row execute function public.enforce_content_filter('caption');

create trigger trg_post_comments_content_filter
before insert or update of body on public.post_comments
for each row execute function public.enforce_content_filter('body');

create trigger trg_profiles_content_filter
before insert or update of username, display_name on public.profiles
for each row execute function public.enforce_content_filter('username', 'display_name');

-- ── Starter blocklist ───────────────────────────────────────────
-- Slurs and sexually explicit terms only, per the note above. This
-- is a starting point, not a finished list — extend it from what
-- actually turns up in content_reports:
--   insert into public.blocked_terms (term) values ('...');
-- Terms must be lowercase a-z0-9, 3-40 characters. Normalisation
-- means only the plain spelling is needed; leetspeak and padded
-- variants are matched automatically.
insert into public.blocked_terms (term) values
  -- racial and ethnic slurs
  ('nigger'), ('nigga'), ('chink'), ('gook'), ('spic'),
  ('wetback'), ('kike'), ('paki'), ('coon'), ('raghead'), ('towelhead'),
  ('beaner'), ('gypo'), ('abo'), ('darkie'),
  -- sexuality and gender identity slurs
  ('faggot'), ('fagot'), ('fag'), ('dyke'), ('tranny'), ('shemale'),
  ('ladyboy'), ('homo'),
  -- disability slurs
  ('retard'), ('retarded'), ('mongoloid'), ('spastic'),
  -- sexually explicit
  ('porn'), ('porno'), ('pornhub'), ('blowjob'), ('handjob'), ('rimjob'),
  ('creampie'), ('cumshot'), ('bukkake'), ('gangbang'), ('hentai'),
  ('dildo'), ('buttplug'), ('milf'), ('camgirl'), ('escort'), ('nudes'),
  ('onlyfans'), ('sexcam'), ('xxx'),
  -- sexual violence and child abuse
  ('rape'), ('raped'), ('rapist'), ('molest'), ('pedo'), ('pedophile'),
  ('paedophile'), ('jailbait'), ('lolicon'),
  -- targeted harassment
  ('killyourself'), ('kys'), ('killurself')
on conflict (term) do nothing;


-- ════════════════════════════════════════════════════════════════
--  4. ACCOUNT DELETION
-- ════════════════════════════════════════════════════════════════

-- Guideline 5.1.1(v): an app that supports account creation must
-- offer account deletion inside the app.
--
-- Every user-owned table references auth.users(id) ON DELETE CASCADE
-- — exercises, exercise_defs, presets, profiles, friendships, posts,
-- post_likes, post_comments, ai_generation_log, cardio_sessions and
-- user_blocks, with exercise_sets and preset_exercises cascading in
-- turn from their parents — so deleting the auth row erases
-- everything. content_reports is the deliberate exception: its
-- foreign keys are ON DELETE SET NULL, so a deleted user's reports
-- survive as anonymous records and reports *about* them survive with
-- the username snapshot intact.
--
-- security definer because auth.users is not writable by the
-- authenticated role; the fixed search_path and the auth.uid() guard
-- are what keep that safe. It can only ever delete the caller.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
