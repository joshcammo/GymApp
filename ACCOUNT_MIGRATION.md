# Account migration — personal to CamoTech Solutions

Everything currently sits on Josh's **personal** accounts. It needs to sit on
**CamoTech Solutions** business accounts before the app ships.

Deferred on 2026-09-22, picked back up 2026-09-24. **All four decisions are now
made** and the code change is merged. What's left is entirely manual account
work — see "Runbook".

**If you are picking this up in a new session: read "Decisions needed" for
what was decided and why, then "Runbook" for what's still outstanding.**

---

## Why this has to happen before the first build

One item is still an effective one-way door:

1. **Apple Developer account type.** ~~An individual enrolment cannot be
   converted into an organization.~~ **Decided 2026-09-24: Individual
   enrolment**, using the CamoTech email as the Apple ID. CamoTech Solutions is
   an ABN sole trader, not a registered company — D-U-N-S numbers go to
   registered legal entities, so Organization enrolment isn't realistically
   available here. This is not a workaround; it's the correct enrolment type
   for a sole trader. Consequence to accept: the App Store **Seller** name will
   show Josh's personal legal name, not "CamoTech Solutions" — that's fixed by
   Apple for Individual accounts regardless of enrolment email. App icon, name
   and description are unaffected. This holds even for future apps — one
   Individual account can publish unlimited apps, but the Seller name is
   account-wide, not per-app. **Confirmed 2026-09-24: stay Individual, revisit
   only if CamoTech Solutions ever incorporates** (a future Organization
   enrolment would need its own D-U-N-S and Apple's app-transfer process to
   move existing apps over — not guaranteed per app, so not a decision to
   make speculatively now).
2. **The bundle identifier.** `com.gymtracker.app` becomes permanent the moment
   the App Store Connect record is created. It is also wrong twice over: it is
   reverse-DNS for `gymtracker.app`, a domain we do not own, and the app name
   is changing anyway.

Both `ios.bundleIdentifier` and `expo.owner` are **native config**, so a build
made before this migration is a build that gets thrown away. This work and the
app-name decision should land in the same pass, since both block the build for
the same reason.

---

## Decisions needed — all four settled 2026-09-24

| # | Decision | Notes |
|---|---|---|
| 1 | ~~Apple enrolment: organization~~ | **Decided & done:** Individual enrolment, CamoTech email as Apple ID. Enrolled 2026-09-24. |
| 2 | ~~Bundle identifier~~ | **Decided:** `au.com.camotechsolutions.ctsfitness`. Landed in `mobile/app.json`, not yet built. |
| 3 | ~~GitHub destination~~ | **Decided:** Josh's personal GitHub account signed in with the CamoTech email, username `joshcamotech`. Target repo `github.com/joshcamotech/CTS-Fitness`. |
| 4 | ~~Legal pages subdomain~~ | **Decided:** `ctsfitness.camotechsolutions.com.au`. Landed in `mobile/src/constants/legal.ts` and `docs/CNAME`. |

App name is also decided: **CTS Fitness**, checked clear against the App
Store on 2026-09-24 — see `APP_STORE_CONNECT.md` §1.

---

## Inventory

Where each piece lives today, and what moving it costs.

| Thing | Today | Move to | Effort | Changes app code? |
|---|---|---|---|---|
| Apple Developer | **enrolled** (Individual, CamoTech email) | — done | done | no |
| App name / Bundle ID | ~~GymTracker~~ / ~~`com.gymtracker.app`~~ | **CTS Fitness** / `au.com.camotechsolutions.ctsfitness` | done in code, needs a build | **yes — rebuild** |
| GitHub | `joshcammo/GymApp` | `joshcamotech/CTS-Fitness` | ~20 min | Pages URL only |
| Supabase | personal org | CamoTech org | ~5 min | **no** |
| Expo / EAS | owner `joshcammo` | Expo org | ~15 min | `app.json` owner |
| Gemini API key | personal Google | CamoTech Google | ~5 min | no |
| Domain, support email | already CamoTech | — | — | — |

**Code change landed 2026-09-24** — name, bundle ID, legal URLs and the
custom-domain CNAME are all done:

```
mobile/app.json                  expo.name, ios.bundleIdentifier, android.package
mobile/src/constants/legal.ts    privacyUrl, termsUrl, supportUrl
docs/CNAME                       new file — ctsfitness.camotechsolutions.com.au
docs/privacy.html, terms.html,
  index.html, style.css          GymTracker → CTS Fitness throughout
README.md                        title
APP_STORE_SUBMISSION.md          URL table, blocker status
APP_STORE_CONNECT.md             enrolment type, app name, listing URLs
```

`expo.owner` was deliberately left as `joshcammo` — the Expo org transfer
hasn't happened yet, so changing it now would break EAS Update.

---

## Custom domain for the legal pages

Worth doing as part of this rather than separately.

The privacy policy and support URLs are baked into the app **and** submitted to
Apple. Today they are `https://joshcammo.github.io/GymApp/...`, which is tied
to the personal GitHub account — so transferring the repo moves them, and
moving them after submission means editing the App Store listing.

Pointing them at a domain we own (`ctsfitness.camotechsolutions.com.au`,
decided 2026-09-24) decouples them permanently: the URL survives any future
repo or account move, and it reads as a business rather than someone's
personal GitHub. `legal.ts` and `docs/CNAME` already point at it — it just
isn't live yet, pending the DNS record and Pages setting below.

GitHub Pages supports this free. It needs a DNS record and a `docs/CNAME` file.

> Do this **before** submitting to Apple. Afterwards, changing the privacy
> policy URL means updating the App Store Connect listing, and a dead privacy
> URL is a 2.1 rejection on its own.

---

## Runbook

Ordered so nothing blocks on something later in the list. Steps 2–6 can be done
in any order once step 1 is under way.

### 1. Apple Developer Program

- Enrol at [developer.apple.com/programs](https://developer.apple.com/programs/)
  as an **Individual**, using the CamoTech email as the Apple ID. CamoTech
  Solutions is an ABN sole trader, not a registered company, so Organization
  enrolment (which needs a D-U-N-S number) isn't realistically available —
  Individual is the correct type here, not a fallback.
- The App Store "Seller" name will show Josh's personal legal name, not
  "CamoTech Solutions" — that's an Apple rule for Individual accounts and
  isn't affected by which email you enrol with. App icon, name and
  description are unaffected.
- Once active, check **Agreements, Tax, and Banking**. A free app still needs
  the Free Applications agreement accepted, and an unaccepted agreement
  silently blocks submission.
- Do **not** create the App Store Connect app record yet — that is what locks
  the bundle ID, and the name is not decided.

### 2. GitHub

- `joshcamotech/CTS-Fitness` already exists as an empty placeholder repo
  (created to reserve the name). GitHub's ownership transfer refuses to land
  if the destination name is taken, so **first rename or delete the
  placeholder** (e.g. rename it to `CTS-Fitness-placeholder` temporarily).
- Transfer `joshcammo/GymApp` to `joshcamotech`: repo Settings → General →
  Danger Zone → Transfer ownership. Accept the transfer on the `joshcamotech`
  side (may arrive as an email invite).
- Rename the transferred repo from `GymApp` to `CTS-Fitness` — repo Settings →
  General → repository name.
- Delete the `CTS-Fitness-placeholder` repo once the rename above is confirmed,
  if it had no other content.
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

- DNS: `CNAME` record — `ctsfitness.camotechsolutions.com.au` →
  `joshcamotech.github.io`.
- ~~Add `docs/CNAME`~~ — **done**, already in the repo, pointing at
  `ctsfitness.camotechsolutions.com.au`.
- Repo Settings → Pages → Custom domain → enter it → wait for the check → tick
  **Enforce HTTPS**.
- Confirm all three URLs return 200 on the new domain. `legal.ts` already
  points there — until this step is done, those links are dead, which is fine
  pre-submission but **must** be fixed before Apple review.

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

## The code change — done 2026-09-24

Landed: `mobile/app.json` (`expo.name`, `ios.bundleIdentifier`,
`android.package` — **not** `expo.owner`, that's still pending the Expo
transfer), `mobile/src/constants/legal.ts`, `docs/CNAME` (new),
`docs/privacy.html`/`terms.html`/`index.html`/`style.css`, `README.md`,
`APP_STORE_SUBMISSION.md`, `APP_STORE_CONNECT.md`.

Not touched, deliberately: `supabase/migrations/023_moderation_and_account_deletion.sql`
still has a "GymTracker" string in a user-facing moderation error message —
that migration is already applied to production, so fixing it needs a *new*
migration, not an edit to an applied one. Separate task if wanted.
`supabase/scripts/seed_demo_account.sql` untouched — demo email addresses
didn't change.

Do **not** change `expo.slug` or the EAS `projectId`. The slug is tied to the
existing EAS project, and the project id is what `updates.url` points at.
Neither changed.

The OTA workflow will warn on the next push to `main` that `app.json` changed
and an update cannot deliver it. That warning is correct: **`bundleIdentifier`
needs a fresh `eas build`, not an OTA update.** Don't build yet — wait until
the GitHub transfer and custom domain are done, so the build's baked-in legal
URLs are already live.

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
