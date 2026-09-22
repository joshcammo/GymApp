# Account migration — personal to CamoTech Solutions

Everything currently sits on Josh's **personal** accounts. It needs to sit on
**CamoTech Solutions** business accounts before the app ships.

Deferred on 2026-09-22 — written down so it can be picked up cold. Nothing here
has been started.

**If you are picking this up in a new session: read "Decisions needed" first.
Four answers unblock the whole thing, and two of them are permanent.**

---

## Why this has to happen before the first build

Two items are effectively one-way doors, and both are still free to get right
because nothing has been created yet:

1. **Apple Developer account type.** An individual enrolment cannot be
   converted into an organization. Enrolling personally and moving later means
   a second enrolment plus Apple's app-transfer process, which has conditions
   (the app must already be released, agreements clean, no shared bundle IDs)
   and is not guaranteed. Enrolling as CamoTech from the start costs nothing
   extra.
2. **The bundle identifier.** `com.gymtracker.app` becomes permanent the moment
   the App Store Connect record is created. It is also wrong twice over: it is
   reverse-DNS for `gymtracker.app`, a domain we do not own, and the app name
   is changing anyway.

Both `ios.bundleIdentifier` and `expo.owner` are **native config**, so a build
made before this migration is a build that gets thrown away. This work and the
app-name decision should land in the same pass, since both block the build for
the same reason.

---

## Decisions needed

Nothing can start until these four are answered. The first two are permanent.

| # | Decision | Notes |
|---|---|---|
| 1 | **Apple enrolment: organization** | Needs a D-U-N-S number for CamoTech Solutions. Slowest item — start it first. Sets the seller name shown publicly on the listing. |
| 2 | **Bundle identifier** | Suggest `au.com.camotechsolutions.<appname>`. Permanent once the App Store Connect record exists. |
| 3 | **GitHub org name** | `camotechsolutions`? `camotech`? Becomes part of the repo URL. |
| 4 | **Legal pages subdomain** | e.g. `gymapp.camotechsolutions.com.au`. See "Custom domain" below. |

Decision 4 depends on the app name, which is the other outstanding blocker —
see `APP_STORE_SUBMISSION.md` → "Pick up here".

---

## Inventory

Where each piece lives today, and what moving it costs.

| Thing | Today | Move to | Effort | Changes app code? |
|---|---|---|---|---|
| Apple Developer | **not enrolled** | CamoTech org enrolment | days (verification) | no |
| Bundle ID | `com.gymtracker.app` | `au.com.camotechsolutions.*` | 1 line | **yes — rebuild** |
| GitHub | `joshcammo/GymApp` | CamoTech org | ~20 min | Pages URL only |
| Supabase | personal org | CamoTech org | ~5 min | **no** |
| Expo / EAS | owner `joshcammo` | Expo org | ~15 min | `app.json` owner |
| Gemini API key | personal Google | CamoTech Google | ~5 min | no |
| Domain, support email | already CamoTech | — | — | — |

Total code surface: **9 references to `joshcammo` across 4 files**, five of
which are documentation.

```
mobile/app.json                  owner
mobile/src/constants/legal.ts    privacyUrl, termsUrl, supportUrl
APP_STORE_SUBMISSION.md          URL table
APP_STORE_CONNECT.md             listing table
```

---

## Custom domain for the legal pages

Worth doing as part of this rather than separately.

The privacy policy and support URLs are baked into the app **and** submitted to
Apple. Today they are `https://joshcammo.github.io/GymApp/...`, which is tied
to the personal GitHub account — so transferring the repo moves them, and
moving them after submission means editing the App Store listing.

Pointing them at a domain we own (`gymapp.camotechsolutions.com.au`) decouples
them permanently: the URL survives any future repo or account move, and it
reads as a business rather than someone's personal GitHub.

GitHub Pages supports this free. It needs a DNS record and a `docs/CNAME` file.

> Do this **before** submitting to Apple. Afterwards, changing the privacy
> policy URL means updating the App Store Connect listing, and a dead privacy
> URL is a 2.1 rejection on its own.

---

## Runbook

Ordered so nothing blocks on something later in the list. Steps 2–6 can be done
in any order once step 1 is under way.

### 1. Apple Developer Program — start first, it is the long pole

- Enrol at [developer.apple.com/programs](https://developer.apple.com/programs/)
  as an **organization**, not an individual.
- Needs a D-U-N-S number for CamoTech Solutions. Look it up or request it via
  Apple's D-U-N-S lookup tool — free, but can take days on its own.
- Once active, check **Agreements, Tax, and Banking**. A free app still needs
  the Free Applications agreement accepted, and an unaccepted agreement
  silently blocks submission.
- Do **not** create the App Store Connect app record yet — that is what locks
  the bundle ID, and the name is not decided.

### 2. GitHub organization

- Create the org (free plan is fine).
- Transfer `joshcammo/GymApp` to it: repo Settings → General → Danger Zone →
  Transfer ownership.
- **Then verify, before trusting the pipeline again:**
  - `secrets.EXPO_TOKEN` still exists — Settings → Secrets and variables →
    Actions.
  - `vars.EXPO_PUBLIC_SUPABASE_URL` and `vars.EXPO_PUBLIC_SUPABASE_ANON_KEY`
    still exist. **If these are missing, the OTA workflow publishes a bundle
    that crashes on launch before any UI renders** — this has happened before,
    see the note in `.github/workflows/eas-update.yml`.
  - GitHub Pages is still enabled and building from `main` → `/docs`.
  - Actions are enabled on the org (some orgs default them off).
- Re-check `gh auth status`. Pushes touching `.github/workflows/` need the
  `workflow` scope; if it is missing, `gh auth refresh -h github.com -s workflow`.
- Turn on **Secret scanning** and **Push protection** while in the settings —
  free on public repos, and still not done.

### 3. Custom domain

- DNS: `CNAME` record for the chosen subdomain →
  `<org>.github.io`.
- Add `docs/CNAME` containing just the bare hostname. **This is a code change —
  ask and it gets done in the same PR as the rest.**
- Repo Settings → Pages → Custom domain → enter it → wait for the check → tick
  **Enforce HTTPS**.
- Confirm all three URLs return 200 on the new domain before changing
  `legal.ts`.

### 4. Supabase

- Create a CamoTech organization.
- Project Settings → General → Transfer project.
- **The project ref does not change on an organization transfer**, so
  `EXPO_PUBLIC_SUPABASE_URL` and the anon key stay valid: no data migration, no
  downtime, no app change. Confirm the project URL really is unchanged before
  assuming it — if it changed, the two GitHub Actions variables and every
  installed app's config need updating, which is a much bigger job.
- Free tier allows one free project per org, so the target org must be empty.
- Re-check the `GEMINI_API_KEY` secret survived, under Edge Functions secrets.

### 5. Expo / EAS

- Create an Expo organization account.
- Transfer the project to it from the EAS dashboard.
- `expo.owner` in `mobile/app.json` then changes to the org slug — a code
  change, done in the same PR.
- Doing this before the first build avoids moving credentials and an OTA
  channel that already has users on it.

### 6. Google Gemini key

- Create the key on the CamoTech Google account at
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- Replace the `GEMINI_API_KEY` secret on the Supabase Edge Function.
- Revoke the personal key **after** confirming the AI Workout screen still
  works, not before.
- No code change — the key is only ever read from the function's environment.

---

## The code change

One PR, once decisions 2–4 are made. Small:

- `mobile/app.json` — `ios.bundleIdentifier`, `android.package`, `expo.owner`
  (and `expo.name`, if the app name is settled in the same pass)
- `mobile/src/constants/legal.ts` — the three URLs
- `docs/CNAME` — new file, the bare hostname
- `APP_STORE_SUBMISSION.md`, `APP_STORE_CONNECT.md` — URL tables
- `supabase/scripts/seed_demo_account.sql` — only if the demo email addresses
  change

Do **not** change `expo.slug` or the EAS `projectId`. The slug is tied to the
existing EAS project, and the project id is what `updates.url` points at.

After merging, the OTA workflow will warn that `app.json` changed and an update
cannot deliver it. That warning is correct: **`bundleIdentifier` and `owner`
need a fresh `eas build`, not an OTA update.** The `legal.ts` URLs would ship
over the air fine on their own, but nothing is installed from the store yet, so
it does not matter here.

---

## What is not affected

- **No database migration.** Data stays in the same Supabase project; only the
  owning organization changes.
- **No user impact.** Nothing is in the App Store yet and the OTA channel has
  no store-installed users on it.
- **No secrets in the repo to rotate.** The Supabase anon key lives in GitHub
  Actions variables and is safe to expose regardless — RLS is the access
  boundary. The Gemini key lives only in the Edge Function environment.
- Git history, issues and PRs survive a GitHub repo transfer, and the old repo
  URL redirects. The old **Pages** URL is the thing not to rely on, which is
  what the custom domain solves.
