# App Store Submission — working checklist

Living document. Started 2026-09-21 on branch `feat/app-store-compliance`.
Audited against the [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
as published September 2026.

**If you are picking this up in a new session: read "Current state", then
"Blocking manual steps", then work the next unchecked phase.**

---

## Current state

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Audit + this checklist | done |
| 1 | Legal pages (privacy / terms / support) | done — Pages not yet enabled |
| 2 | Migration 023: blocks, reports, content filter, account deletion | applied to production 2026-09-21 |
| 3 | Settings: legal links, blocked users, delete account | done |
| 4 | Report + block UI, sign-up terms gate, AI disclaimer | done |
| 5 | `app.json` / `eas.json` build + submit config | done |
| 6 | App Store Connect submission pack | not started |

Decisions made 2026-09-21:

- Legal pages hosted on **GitHub Pages from `/docs` in this repo**.
- Moderation backend is **reports table + instant block**, no email alerts and
  no admin screen. Reports are read by querying `content_reports` in the SQL
  editor.
- Work branches from `origin/main`. Migrations start at **023** —
  `022_pr_source_location.sql` is unrelated work-in-progress sitting
  uncommitted on `fix/lockfile-peer-deps`.

---

## Blocking manual steps

None of this can be done from a coding session. All of it has to happen before
submission, and the first two before the app will even run correctly.

1. ~~Run migration 023~~ — **done 2026-09-21**. Confirm it applied *completely*
   with the verification query in Phase 2 before trusting it; a partial apply
   is worse than none.
2. **Enable GitHub Pages**: repo Settings → Pages → Deploy from branch → `main`
   → `/docs`. Until this is live the three in-app legal links 404, which is
   itself a rejection under 2.1 ("fully functional URLs"). **Note the pages
   only exist on `feat/app-store-compliance` so far — they reach `main` when
   PR #36 merges, and Pages serves from `main`.**
3. **Test on a real device** — see "What has not been tested".
4. **Create the demo account** for App Store Connect (Phase 6).
5. **Decide on the app name** — see Phase 6.

---

## Why this app is a harder submission than it looks

The app is not just a workout logger. It has a **social layer** — usernames,
display names, friend requests, shared PR posts with free-text captions, and
comments — which makes it a user-generated-content app under **Guideline 1.2**,
even though visibility is friends-only. Apple does not exempt friends-only
feeds. It also sends user prompts and 30 days of training history to **Google
Gemini**, which triggers the third-party-AI disclosure wording in **5.1.2(i)**.

---

## Phase 1 — Legal pages (done)

Apple requires a public privacy policy URL (5.1.1(i)), a support URL with a
working contact method (1.5), and, for UGC apps, terms the user agrees to that
carry a zero-tolerance clause (1.2).

- [x] `docs/index.html` — support / contact landing page
- [x] `docs/privacy.html` — privacy policy
- [x] `docs/terms.html` — terms of use / EULA with zero-tolerance clause
- [x] `docs/style.css` — shared styling, mirrors the app's dark palette
- [x] `docs/.nojekyll` so Pages serves the HTML verbatim
- [ ] **Manual:** enable GitHub Pages (see Blocking manual steps)
- [ ] **Manual:** confirm all three URLs load publicly before submitting

URLs once Pages is on — these are what the app links to and what goes into App
Store Connect:

| Page | URL |
|------|-----|
| Support | `https://joshcammo.github.io/GymApp/` |
| Privacy policy | `https://joshcammo.github.io/GymApp/privacy.html` |
| Terms of use | `https://joshcammo.github.io/GymApp/terms.html` |

The privacy policy names every processor and confirms equivalent protection, as
5.1.1(i) requires:

| Third party | What it receives | Why |
|-------------|------------------|-----|
| Supabase | all account and workout data | hosting, database, auth |
| Google (Gemini API) | AI prompt + 30 days of training history | AI workout generation |
| Expo / EAS | device platform, app version, IP | over-the-air app updates |
| Apple | purchase/download metadata | App Store distribution |

No analytics SDK, no ad network, no tracking, no data sale. **Keep it that way**
— adding any of them changes both this policy and the privacy nutrition label.

**Contact address** is `josh@camotechsolutions.com.au`, which becomes publicly
visible on the Pages site. Swap it for a dedicated support alias if you would
rather not publish your business address; it appears in `docs/*.html` and in
`mobile/src/constants/legal.ts`.

---

## Phase 2 — Migration 023 (applied 2026-09-21)

`supabase/migrations/023_moderation_and_account_deletion.sql`.

### Verify it applied completely

Run this in the SQL editor. Every row should read `ok`; anything else means the
migration stopped partway and the objects after that point are missing.

```sql
select 'table user_blocks'     as object, case when to_regclass('public.user_blocks')     is not null then 'ok' else 'MISSING' end as status
union all select 'table content_reports',  case when to_regclass('public.content_reports')   is not null then 'ok' else 'MISSING' end
union all select 'table blocked_terms',    case when to_regclass('public.blocked_terms')     is not null then 'ok' else 'MISSING' end
union all select 'fn is_blocked',          case when to_regproc('public.is_blocked')         is not null then 'ok' else 'MISSING' end
union all select 'fn block_user',          case when to_regproc('public.block_user')         is not null then 'ok' else 'MISSING' end
union all select 'fn unblock_user',        case when to_regproc('public.unblock_user')       is not null then 'ok' else 'MISSING' end
union all select 'fn my_blocked_users',    case when to_regproc('public.my_blocked_users')   is not null then 'ok' else 'MISSING' end
union all select 'fn report_content',      case when to_regproc('public.report_content')     is not null then 'ok' else 'MISSING' end
union all select 'fn is_objectionable',    case when to_regproc('public.is_objectionable')   is not null then 'ok' else 'MISSING' end
union all select 'fn delete_my_account',   case when to_regproc('public.delete_my_account')  is not null then 'ok' else 'MISSING' end
union all select 'blocklist seeded',       case when (select count(*) from public.blocked_terms) >= 50 then 'ok'
                                                else 'ONLY ' || (select count(*) from public.blocked_terms)::text end
union all select 'content filter triggers', case when (select count(*) from pg_trigger
                                                       where tgname in ('trg_posts_content_filter',
                                                                        'trg_post_comments_content_filter',
                                                                        'trg_profiles_content_filter')) = 3
                                                then 'ok' else 'MISSING' end;
```

If anything is missing, the migration is **not** safely re-runnable as a whole —
`create table` and `create function` (without `or replace`) will fail on the
objects that did land. Drop what it created and re-run the whole file, or apply
just the missing tail by hand.

- [x] `public.user_blocks` — per-direction, cascade from `auth.users`
- [x] `public.is_blocked(a, b)` — direction-agnostic, `security definer`
- [x] Blocking folded into `are_friends()`, so all six dependent policies on
      `posts` / `post_likes` / `post_comments` inherit it, as does anything
      added later that reuses the helper
- [x] Explicit author checks added to the comment and like select policies — a
      block has to hold between two people commenting under a *mutual friend's*
      post, which the friendship check alone does not cover
- [x] `profiles` search hides blocked users, or the block is worked around by
      re-sending a friend request
- [x] `send_friend_request()` refuses across a block, using the same error text
      as "no such user" so the block is not disclosed to the sender
- [x] `block_user()` also deletes any friendship or pending request, both
      directions; `unblock_user()` deliberately does not restore it
- [x] `my_blocked_users()` — `security definer`, because `profiles` search now
      hides the very users the blocker needs to see listed
- [x] `public.content_reports` + `report_content()` — write-only for users,
      snapshots the reported text so a report outlives both the content and the
      accounts (`ON DELETE SET NULL`, not `CASCADE`)
- [x] `public.blocked_terms` + `normalize_for_filter()` + `is_objectionable()` +
      BEFORE triggers on `posts.caption`, `post_comments.body`,
      `profiles.username`, `profiles.display_name`
- [x] `public.delete_my_account()` — `security definer`, deletes the caller's
      `auth.users` row. Every user-owned table cascades from `auth.users`, so
      this is sufficient. Verified 2026-09-21 across `exercises`,
      `exercise_defs`, `presets`, `profiles`, `friendships`, `posts`,
      `post_likes`, `post_comments`, `ai_generation_log`, `cardio_sessions`.
- [x] **Manual:** run it in the Supabase SQL editor — done 2026-09-21

> **Applied to production 2026-09-21 by Josh.** It was never executed from a
> coding session — there is no local Postgres, Docker or Supabase CLI on this
> machine — so it went to production reviewed statically rather than tested.
> Run the verification query above, and treat the first real use of each
> feature as the actual test. Static review caught and fixed four defects
> before it was applied: a duplicated character in the `translate()` leet map; a
> two-character term failing the three-character minimum on
> `blocked_terms.term`, which would have aborted the entire migration;
> `INSERT ... RETURNING` in `report_content()` requiring a SELECT policy that
> the write-only report queue deliberately does not have; and a
> substring-matching pass that rejected "scraped my shin". **Expect to iterate
> on first run.**

Target Postgres is **17.6** (from `supabase/.temp/postgres-version`), so the
`NULLS NOT DISTINCT` index (PG15+) is supported.

### Reviewing reports

There is no admin UI, by design. In the Supabase SQL editor:

```sql
select id, created_at, target_type, target_username, reason, details, target_snapshot
from public.content_reports
where status = 'open'
order by created_at desc;
```

Then action it and close the loop:

```sql
update public.content_reports
set status = 'actioned', reviewed_at = now(), reviewer_notes = 'removed the post'
where id = 1;
```

The terms and the support page both promise review **within 24 hours**. That is
a commitment a reviewer may test, and it is the standard for UGC apps.

To extend the filter from what reports actually surface, insert into
`public.blocked_terms`. Terms must be lowercase `a-z0-9`, 3–40 characters.
Normalisation handles leetspeak and repeated letters, so only the plain
spelling is needed.

---

## Phase 3 — Settings (done)

- [x] Support & Contact, Privacy Policy, Terms of Use — open the Pages URLs
- [x] Blocked Users — list and unblock
- [x] **Delete Account** — typed confirmation, then `delete_my_account()`
- [x] Settings reorganised into ACCOUNT / SAFETY / ABOUT sections with a scroll
      container, having grown from five rows to ten

Deviation from the original plan: **Blocked Users is a modal, not a stack
screen.** It matches the existing picker-modal pattern, and it avoids editing
`RootStackParamList` in `mobile/src/types/index.ts` while unrelated
work-in-progress is sitting uncommitted in that file.

Delete uses a typed `DELETE` confirmation rather than `Alert.prompt`, which is
iOS-only. It signs out with `scope: 'local'`, because the user the session
belongs to no longer exists server-side and a normal sign-out would fail and
strand the app on a dead session.

---

## Phase 4 — Moderation UI (done)

- [x] Overflow menu on `PostCard` — delete on your own posts, report/block on
      everyone else's (replaces the own-post-only trash button)
- [x] Overflow menu on each comment in `PostDetailScreen`
- [x] Overflow menu on `FriendsScreen` search results and friend rows
- [x] `ReportModal` — reason picker, optional detail, and an "also block" toggle
- [x] `useContentActions` holds the Alert, the sheet and the post-block cleanup,
      so the three screens don't each reimplement them
- [x] Sign-up gate in `LoginScreen`: required checkbox with tappable Terms and
      Privacy links and the zero-tolerance line; Sign Up stays disabled until it
      is ticked
- [x] `AiWorkoutScreen` discloses the Gemini call at the point it happens
      (5.1.2(i)) and disclaims generated training as non-medical advice (1.4.1)

Deviation from the original plan: **no client-side copy of the blocklist.** The
trigger raises a user-facing message, and all four content-write paths —
caption, comment, username setup, username change — already surface
`error.message` verbatim in an Alert. Shipping the terms in the bundle would
only hand an evasion guide to anyone who unzips the IPA.

Blocking triggers a local list cleanup in each screen, because RLS hides the
blocked user's content from the *next* fetch while the list on screen was loaded
before the block existed. On `PostDetailScreen`, blocking the post's author
makes the post itself unreadable, so it pops back to the feed.

---

## Phase 5 — Build and submit config (done)

- [x] `app.json` — `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`, so you
      stop answering the export-compliance prompt on every build
- [x] `eas.json` — `production` build profile with `distribution: "store"` and
      `autoIncrement: true`; a `preview` profile for internal builds; a named
      `submit.production` profile
- [ ] **Manual:** `eas build --platform ios --profile production`
- [ ] **Manual:** `eas submit --platform ios --profile production`. The submit
      profile is intentionally empty so EAS prompts for your Apple ID, App Store
      Connect app ID and team ID on first run, rather than this repo carrying
      guessed values.
- [ ] **Manual: verify the built IPA's app icon has no alpha channel.** All four
      PNGs in `mobile/assets/` are RGBA (colour type 6). Expo normally flattens
      the iOS icon during prebuild, but Apple rejects icons with transparency,
      so confirm it in the actual build rather than assuming.
- [ ] **Manual:** after the first upload, watch for an ITMS-91053 email about
      missing privacy-manifest reasons. The app's own code calls no
      required-reason APIs directly, and async-storage ships its own manifest,
      so none is expected — but confirm rather than assume.

Corrected from the original plan: **no `ios.buildNumber` in `app.json`.** With
`cli.appVersionSource: "remote"`, EAS owns the build number, so a local value is
ignored; `autoIncrement` on the build profile is the correct pairing.

Note that `.github/workflows/eas-update.yml` publishes OTA updates on every push
to `main`. Native and config changes are **not** covered by OTA — the Phase 5
changes need a fresh `eas build`.

---

## Phase 6 — App Store Connect (not started)

Not code. Do this after a build is uploaded.

- [ ] **App name** — "GymTracker" is generic and very likely collides with
      existing App Store apps. Search the store and check trademarks before
      burning a review cycle. 30-character limit (2.3.7).
- [ ] **Demo account** (2.1) — the app is login-gated, so review *will* fail
      without working credentials in the review notes. Create a dedicated
      account and seed it with several weeks of workouts, at least one friend,
      and a few posts and comments, so the reviewer can actually exercise the
      social and moderation features instead of staring at an empty feed.
- [ ] **Notes for Review** (2.3.1(a)) — describe the AI generator and the social
      features *specifically*; generic descriptions get rejected. State where
      Report and Block live, because a reviewer who cannot find them will reject
      under 1.2. Suggested wording:

  > Social features are friends-only and require an accepted friend request.
  > Report and Block are on the overflow menu of any post or comment, and on the
  > overflow menu of any user in Friends. Blocked users are managed in
  > Settings → Blocked Users. Account deletion is Settings → Delete Account.
  > The AI Workout screen sends the user's typed prompt and a summary of their
  > last 30 days of training to Google's Gemini API to generate a suggestion;
  > this is disclosed on that screen and in the privacy policy.

- [ ] **Privacy nutrition label** — email address, user content, health &
      fitness, identifiers. Linked to identity; **not** used for tracking.
- [ ] **Age rating** — answer honestly; the UGC and social features drive this.
- [ ] Category: Health & Fitness
- [ ] Screenshots for every required device size
- [ ] Privacy policy URL and support URL from Phase 1

---

## What has not been tested

Being explicit, because none of this was verifiable from a coding session on
this machine:

- **Migration 023 was applied to production without ever being executed in a
  test environment.** Its behaviour is unverified beyond static review.
- **No app code has been run.** There is no simulator, emulator or device
  available here. `tsc --noEmit` passes, and that is the only gate this project
  has — there is no ESLint, Prettier or test setup in the repo.
- The **legal pages have not been served**; they were link-checked on disk only.
- **No iOS build has been produced**, so the icon-alpha and privacy-manifest
  items above are unverified.

Worth walking through on a real device once the migration is applied, in this
order, since later steps depend on earlier ones:

1. Sign up — Sign Up should stay disabled until the terms box is ticked, and
   both links should open.
2. Settings → Privacy Policy / Terms / Support — all three should load.
3. Set a username containing a blocked term — should be refused with a readable
   message, not a raw Postgres error.
4. Post a caption, then a comment, containing a blocked term — same.
5. From a second account, report a post and then a comment, with "also block"
   off. Check `content_reports` has both rows with the snapshot populated.
6. Block from the overflow menu — content should vanish immediately, and the
   friendship should disappear from both accounts.
7. Settings → Blocked Users → Unblock — the user should reappear in search, but
   **not** as a friend.
8. Confirm a blocked user cannot find you in search or send you a friend request.
9. Settings → Delete Account on a throwaway account — verify it lands back on
   Login and that the rows really are gone across every table.

---

## Assessed as fine, no action needed

- **3.1 Payments** — no IAP, no subscriptions, free app.
- **4.2 Minimum functionality** — substantial native app, comfortably clear.
- **4.8 Login services** — email/password against the app's own Supabase auth.
  Sign in with Apple is **not** required, because the app uses no third-party or
  social login. Adding Google or Facebook sign-in later would trigger 4.8.
- **2.5.1** — Expo SDK 57 / RN 0.86, current, public APIs only.
- **2.5.2** — EAS Update ships JS and assets only, which is permitted; it does
  not change the app's advertised purpose.
- **5.1.5 Location** — no location APIs used.
- No analytics, ad or tracking SDKs, so no ATT prompt is needed.
