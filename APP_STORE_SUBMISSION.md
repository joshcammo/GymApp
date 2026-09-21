# App Store Submission — working checklist

Living document. Started 2026-09-21 on branch `feat/app-store-compliance`.
Audited against the [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
as published September 2026.

**If you are picking this up in a new session: read "Current state" first, then
work the next unchecked phase.**

---

## Current state

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Audit + this checklist | ✅ done |
| 1 | Legal pages (privacy / terms / support) + GitHub Pages | ⬜ not started |
| 2 | Migration 023: blocks, reports, content filter, account deletion | ⬜ not started |
| 3 | Settings: legal links, blocked users, delete account | ⬜ not started |
| 4 | Report + block UI, sign-up terms gate, AI disclaimer | ⬜ not started |
| 5 | `app.json` / `eas.json` build + submit config | ⬜ not started |
| 6 | App Store Connect submission pack | ⬜ not started |

Decisions already made (2026-09-21):

- Legal pages are hosted on **GitHub Pages from `/docs` in this repo**.
- Moderation backend is **reports table + instant client-side block**, no email
  alerts and no admin screen. Reports are reviewed by querying the table.
- Work branches from `origin/main`. Migrations start at **023** — `022_pr_source_location.sql`
  is unrelated work-in-progress sitting uncommitted on `fix/lockfile-peer-deps`.

---

## Why this app is a harder submission than it looks

The app is not just a workout logger. It has a **social layer** — usernames,
display names, friend requests, shared PR posts with free-text captions, and
comments — which makes it a user-generated-content app under **Guideline 1.2**,
even though visibility is friends-only. Apple does not exempt friends-only
feeds. It also sends user prompts and 30 days of training history to **Google
Gemini**, which triggers the third-party-AI disclosure wording in **5.1.2(i)**.

---

## Phase 1 — Legal pages

Apple requires a public privacy policy URL (5.1.1(i)), a support URL with a
working contact method (1.5), and, for UGC apps, terms the user agrees to that
carry a zero-tolerance clause (1.2).

- [ ] `docs/index.html` — support / contact landing page
- [ ] `docs/privacy.html` — privacy policy
- [ ] `docs/terms.html` — terms of use / EULA with zero-tolerance clause
- [ ] `docs/.nojekyll` so Pages serves the HTML verbatim
- [ ] **Manual step:** enable GitHub Pages — repo Settings → Pages → Deploy from
      branch → `main` → `/docs`
- [ ] Verify the three URLs load publicly before submitting

The privacy policy must name every third party that touches user data and
confirm they provide equivalent protection:

| Third party | What it receives | Why |
|-------------|------------------|-----|
| Supabase | all account and workout data | hosting, database, auth |
| Google (Gemini API) | AI prompt text + 30 days of training history | AI workout generation |
| Expo / EAS | device platform, app version, IP | over-the-air app updates |
| Apple | purchase/download metadata | App Store distribution |

No analytics SDK, no ad network, no tracking, no data sale. Keep it that way —
adding any of them changes the privacy nutrition label and this policy.

**Contact address** is currently `josh@camotechsolutions.com.au`. This becomes
publicly visible on the Pages site. Swap it for a dedicated support alias if you
would rather not publish your business address — it is defined in one place per
page.

---

## Phase 2 — Migration `023_moderation_and_account_deletion.sql`

Single idempotent `DO` block is **not** required here (that constraint applies to
data scripts); this is DDL and runs as an ordinary migration in the SQL editor.

- [ ] `public.user_blocks` — blocker/blocked pair, cascade from `auth.users`
- [ ] `public.is_blocked(a, b)` helper, direction-agnostic
- [ ] Fold `is_blocked` into RLS on `posts`, `post_likes`, `post_comments`, and
      into `profiles` search and `send_friend_request`, so a block hides content
      **both ways, immediately**
- [ ] Blocking also deletes any existing friendship row
- [ ] `public.content_reports` — reporter, target (post / comment / user),
      reason, free-text detail, status
- [ ] `public.blocked_terms` + `public.is_objectionable(text)` + BEFORE
      INSERT/UPDATE triggers on `posts.caption`, `post_comments.body`,
      `profiles.username`, `profiles.display_name` (Guideline 1.2 filter)
- [ ] `public.delete_my_account()` — `security definer`, deletes the caller's
      `auth.users` row. Every user-owned table already cascades from
      `auth.users`, so this is sufficient. Verified 2026-09-21 across
      `exercises`, `exercise_defs`, `presets`, `profiles`, `friendships`,
      `posts`, `post_likes`, `post_comments`, `ai_generation_log`,
      `cardio_sessions`.

**Manual step:** run the migration in the Supabase SQL editor before the app
code that calls it ships.

---

## Phase 3 — Settings screen

`mobile/src/screens/SettingsScreen.tsx` currently offers Appearance, Presets,
Change Username, Change Password and Sign Out. Needs:

- [ ] Privacy Policy → opens Pages URL
- [ ] Terms of Use → opens Pages URL
- [ ] Support / Contact → opens Pages URL or `mailto:`
- [ ] Blocked Users → manage / unblock list
- [ ] **Delete Account** → double confirmation, calls `delete_my_account()`,
      then signs out (Guideline 5.1.1(v))

---

## Phase 4 — Moderation UI

- [ ] Overflow menu on `PostCard` — Report post, Block user (own posts: Delete)
- [ ] Overflow / long-press on comments in `PostDetailScreen` — Report, Block
- [ ] Block option on `FriendsScreen` search results and friend rows
- [ ] Client-side term filter with a clear error before submit, so the user is
      not surprised by a raw Postgres exception
- [ ] Sign-up gate in `LoginScreen`: required checkbox agreeing to Terms +
      Privacy, with tappable links and the zero-tolerance line
- [ ] Not-medical-advice disclaimer on `AiWorkoutScreen` (cheap insurance
      against 1.4.1) plus a line noting the request is sent to Google Gemini

---

## Phase 5 — Build and submit config

- [ ] `app.json` → `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`
      (otherwise you answer the export-compliance prompt on every build)
- [ ] `app.json` → `ios.buildNumber`
- [ ] `eas.json` → production iOS build profile (store distribution,
      `autoIncrement`) and a `submit` profile
- [ ] **Verify the built IPA's app icon has no alpha channel.** All four PNGs in
      `mobile/assets/` are RGBA (colour type 6). Expo normally flattens the iOS
      icon during prebuild, but Apple rejects icons with transparency, so this
      must be confirmed in the actual build rather than assumed.
- [ ] Note: `.github/workflows/eas-update.yml` publishes OTA updates on push to
      `main`. Native/config changes are **not** covered by OTA — Phase 5 changes
      require a fresh `eas build`.

---

## Phase 6 — App Store Connect

Not code. Do this last, after a build is uploaded.

- [ ] **App name** — "GymTracker" is generic and very likely collides with
      existing App Store apps. Search the store and check trademarks before
      committing to it. 30-character limit (2.3.7).
- [ ] **Demo account** (2.1) — the app is login-gated, so review *will* fail
      without working credentials in the review notes. Create a dedicated
      account, seed it with several weeks of workouts, at least one friend, and
      a couple of posts and comments, so the reviewer can exercise the social
      and moderation features.
- [ ] **Notes for Review** (2.3.1(a)) — describe the AI workout generator and
      the social/friends features *specifically*. Generic descriptions are
      rejected. State where Report and Block live so the reviewer finds them.
- [ ] **Privacy nutrition label** — email address, user content, health &
      fitness, identifiers. Linked to identity, not used for tracking.
- [ ] **Age rating** — answer honestly; UGC and social features affect this.
- [ ] Category: Health & Fitness
- [ ] Screenshots for required device sizes
- [ ] Privacy policy URL + support URL from Phase 1

---

## Assessed as fine, no action needed

- **3.1 Payments** — no IAP, no subscriptions, free app.
- **4.2 Minimum functionality** — substantial native app, comfortably clear.
- **4.8 Login services** — email/password against the app's own Supabase auth.
  Sign in with Apple is *not* required, because the app uses no third-party or
  social login. Adding Google/Facebook sign-in later would trigger 4.8.
- **2.5.1** — Expo SDK 57 / RN 0.86, current, public APIs only.
- **2.5.2** — EAS Update ships JS/asset updates only, which is permitted for
  interpreted code that does not change the app's advertised purpose.
- **5.1.5 Location** — no location APIs used.
- No analytics, ad, or tracking SDKs, so no ATT prompt needed.
